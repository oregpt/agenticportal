/**
 * Chat Service — Agent Hub
 *
 * Core chat engine: conversation management, LLM calls, tool execution, RAG.
 * Supports multiple independent agents with per-agent settings.
 */

import crypto from 'crypto';
import { db } from '../db/client';
import { agents, conversations, messages, agentCapabilities } from '../db/schema';
import { getProviderForModel } from '../llm';
import { LLMMessage } from '../llm/types';
import { executeWithTools } from '../llm/toolExecutor';
import { eq, desc, and } from 'drizzle-orm';
import { getFeatureFlags } from '../config/appConfig';
import { buildContext } from '../session/contextBuilder';

// ============================================================================
// Helpers
// ============================================================================

export async function ensureDefaultAgent(): Promise<string> {
  const existing = (await db.select().from(agents).limit(1)) as any[];
  if (existing.length) {
    return existing[0].id as string;
  }

  const inserted = (await db
    .insert(agents)
    .values({
      id: 'default-agent',
      slug: 'default',
      name: 'Agent Hub',
      description: 'Default Agent Hub assistant',
      instructions:
        'You are a helpful assistant. Use the knowledge base and tools when relevant and always cite your sources when you rely on retrieved documents.',
      defaultModel: process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514',
    })
    .returning()) as any[];

  return inserted[0].id as string;
}

export async function startConversation(agentId: string, externalUserId?: string, title?: string) {
  const publicId = crypto.randomUUID();
  const sessionToken = crypto.randomBytes(32).toString('hex');

  const rows = (await db
    .insert(conversations)
    .values({ publicId, sessionToken, agentId, externalUserId, title })
    .returning()) as any[];
  return rows[0];
}

export async function appendMessage(
  conversationId: number,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, unknown>
) {
  const rows = (await db
    .insert(messages)
    .values({ conversationId, role, content, metadata: metadata || {} })
    .returning()) as any[];

  return rows[0];
}

/**
 * Validate a conversation by public ID and session token.
 * Returns the conversation row (with internal `id`) or null.
 */
export async function validateConversation(
  publicId: string,
  sessionToken: string
): Promise<any | null> {
  const rows = (await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.publicId, publicId), eq(conversations.sessionToken, sessionToken)))
    .limit(1)) as any[];

  return rows[0] || null;
}

export async function getConversationWithMessages(conversationId: number) {
  const convRows = (await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)) as any[];

  const conv = convRows[0];
  if (!conv) return null;

  const msgRows = (await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.id))) as any[];

  return { conversation: conv, messages: msgRows.reverse() };
}

/**
 * Check if an agent has tools enabled (MCP capabilities or feature-flagged tools)
 */
async function agentHasToolsEnabled(agentId: string): Promise<boolean> {
  const features = getFeatureFlags();

  // If memory or deep tools are enabled globally, tools are available
  if (features.soulMemory || features.deepTools) {
    return true;
  }

  // Check if any MCP capability is enabled for this agent
  const enabledCaps = await db
    .select()
    .from(agentCapabilities)
    .where(and(eq(agentCapabilities.agentId, agentId), eq(agentCapabilities.enabled, 1)));

  return enabledCaps.length > 0;
}

// ============================================================================
// Main Chat Functions
// ============================================================================

export interface ChatReplyResult {
  reply: string;
  sources: { content: string; sourceTitle: string }[];
  toolsUsed?: Array<{
    name: string;
    input: Record<string, unknown>;
    output: string;
    success: boolean;
  }>;
}

export async function generateReply(
  conversationId: number,
  userMessage: string
): Promise<ChatReplyResult> {
  const conv = await getConversationWithMessages(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const agentId = conv.conversation.agentId as string;

  // Check if tools are enabled
  const hasTools = await agentHasToolsEnabled(agentId);

  // Get RAG context (reduced when tools enabled to save tokens)
  let ragContext = '';
  let ragSources: Array<{ content: string; sourceTitle: string }> = [];
  try {
    const { getRelevantContext } = await import('../rag/ragService');
    const ragMaxTokens = hasTools ? 1000 : 2000;
    const rag = await getRelevantContext(agentId, userMessage, ragMaxTokens);
    ragContext = rag.context;
    ragSources = rag.sources;
  } catch {
    // RAG service not available
  }

  // Use contextBuilder to assemble all context
  const ctx = await buildContext(agentId, conversationId, userMessage, { hasTools });

  // Build LLM message array from context
  const history: LLMMessage[] = [];

  // System prompt (from contextBuilder: soul.md + context.md or static instructions)
  history.push({ role: 'system', content: ctx.systemPrompt });

  // Session history (from contextBuilder: recent messages, already truncated)
  history.push(...ctx.sessionHistory);

  // Build user message with RAG context + memory recall
  let userContent = userMessage;
  if (ragContext) {
    userContent += `\n\n---\nRelevant Context from Knowledge Base:\n${ragContext}`;
  }

  // Memory recall from contextBuilder
  if (ctx.memoryContext) {
    userContent += `\n\n---\n${ctx.memoryContext}`;
  }

  history.push({ role: 'user', content: userContent });

  // Get agent model
  const agentRows = (await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)) as any[];
  const agent = agentRows[0];
  const model =
    (agent?.defaultModel as string | null) ||
    process.env.DEFAULT_MODEL ||
    'claude-sonnet-4-20250514';

  // Execute with tool support if enabled
  let reply: string;
  let toolsUsed: ChatReplyResult['toolsUsed'];

  if (hasTools) {
    const result = await executeWithTools(history, {
      model,
      maxTokens: 2048,
      agentId,
      enableTools: true,
    });
    reply = result.reply;
    toolsUsed = result.toolsUsed.length > 0 ? result.toolsUsed : undefined;
  } else {
    // Simple generation without tools
    const provider = getProviderForModel(model);
    reply = await provider.generate(history, {
      model,
      maxTokens: 2048,
      agentId,
    });
  }

  // Save assistant message
  await appendMessage(conversationId, 'assistant', reply, {
    sources: ragSources,
    toolsUsed,
  });

  const sources = ragSources.map((s) => ({ content: s.content, sourceTitle: s.sourceTitle }));

  const returnVal: ChatReplyResult = { reply, sources };
  if (toolsUsed && toolsUsed.length > 0) {
    returnVal.toolsUsed = toolsUsed;
  }
  return returnVal;
}

export async function streamReply(
  conversationId: number,
  userMessage: string,
  onChunk: (delta: string, isFinal: boolean, event?: string) => void
): Promise<ChatReplyResult> {
  const conv = await getConversationWithMessages(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const agentId = conv.conversation.agentId as string;

  // Check if tools are enabled
  const hasTools = await agentHasToolsEnabled(agentId);

  // Get RAG context (reduced when tools enabled to save tokens)
  let ragContext = '';
  let ragSources: Array<{ content: string; sourceTitle: string }> = [];
  try {
    const { getRelevantContext } = await import('../rag/ragService');
    const ragMaxTokens = hasTools ? 1000 : 2000;
    const rag = await getRelevantContext(agentId, userMessage, ragMaxTokens);
    ragContext = rag.context;
    ragSources = rag.sources;
  } catch {
    // RAG service not available
  }

  // Use contextBuilder to assemble all context
  const ctx = await buildContext(agentId, conversationId, userMessage, { hasTools });

  // Build LLM message array from context
  const history: LLMMessage[] = [];

  // System prompt (from contextBuilder: soul.md + context.md or static instructions)
  history.push({ role: 'system', content: ctx.systemPrompt });

  // Session history (from contextBuilder: recent messages, already truncated)
  history.push(...ctx.sessionHistory);

  // Build user message with RAG context + memory recall
  let userContent = userMessage;
  if (ragContext) {
    userContent += `\n\n---\nRelevant Context from Knowledge Base:\n${ragContext}`;
  }

  // Memory recall from contextBuilder
  if (ctx.memoryContext) {
    userContent += `\n\n---\n${ctx.memoryContext}`;
  }

  history.push({ role: 'user', content: userContent });

  // Get agent model
  const agentRows = (await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)) as any[];
  const agent = agentRows[0];
  const model =
    (agent?.defaultModel as string | null) ||
    process.env.DEFAULT_MODEL ||
    'claude-sonnet-4-20250514';

  let full: string;
  let toolsUsed: ChatReplyResult['toolsUsed'];

  if (hasTools) {
    // For tool calling, we can't stream during the tool loop
    // Send "thinking" event so UI knows we're working
    onChunk('', false, 'thinking');

    // Execute tools with progress callback
    const result = await executeWithTools(history, {
      model,
      maxTokens: 2048,
      agentId,
      enableTools: true,
      onToolCall: (toolName: string) => {
        // Notify client about tool usage (just the name, UI adds icon)
        onChunk(toolName, false, 'tool');
      },
    });
    full = result.reply;
    toolsUsed = result.toolsUsed.length > 0 ? result.toolsUsed : undefined;

    // Stream the final response word by word
    const words = full.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      onChunk(word, false);
      // Small delay to simulate streaming
      await new Promise((r) => setTimeout(r, 8));
    }
    onChunk('', true);
  } else {
    // Standard streaming without tools
    const provider = getProviderForModel(model);
    full = '';

    await provider.stream(
      history,
      {
        model,
        maxTokens: 2048,
        agentId,
      },
      (chunk) => {
        if (chunk.type === 'delta') {
          full += chunk.content;
          onChunk(chunk.content, false);
        } else if (chunk.type === 'final') {
          onChunk('', true);
        }
      }
    );
  }

  // Save assistant message
  await appendMessage(conversationId, 'assistant', full, {
    sources: ragSources,
    toolsUsed,
  });

  const sources = ragSources.map((s) => ({ content: s.content, sourceTitle: s.sourceTitle }));

  const returnVal: ChatReplyResult = { reply: full, sources };
  if (toolsUsed && toolsUsed.length > 0) {
    returnVal.toolsUsed = toolsUsed;
  }
  return returnVal;
}
