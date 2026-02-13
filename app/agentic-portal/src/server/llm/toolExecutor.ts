/**
 * Tool Executor — Agent Hub
 *
 * Handles the tool calling loop:
 * 1. Get available tools for an agent (filtered by agent's enabled capabilities)
 * 2. Call LLM with tools
 * 3. Execute tool calls via MCP Hub or built-in tools
 * 4. Loop until final text response
 */

import { LLMMessage, Tool, GenerateResult, ToolCall, GenerateOptions } from './types';
import { getProviderForModel } from './index';
import { getFeatureFlags } from '../config/appConfig';

const MAX_TOOL_ITERATIONS = 10;

export interface ToolExecutorOptions {
  model: string;
  maxTokens?: number;
  agentId: string;
  enableTools?: boolean;
  /** Callback when a tool is being called (for streaming progress) */
  onToolCall?: (toolName: string) => void;
}

export interface ToolExecutorResult {
  reply: string;
  toolsUsed: Array<{
    name: string;
    input: Record<string, unknown>;
    output: string;
    success: boolean;
  }>;
}

/**
 * Get available tools for an agent (simple list form)
 * Tool names are prefixed with server name to ensure uniqueness
 */
export async function getToolsForAgent(_agentId: string): Promise<Tool[]> {
  try {
    const { getOrchestrator } = await import('../mcp-hub/orchestrator');
    const orchestrator = getOrchestrator();
    const registry = orchestrator.serverRegistry;
    const allTools = registry.getAllTools();

    return allTools.map((tool) => ({
      name: `${tool.serverName}__${tool.name}`,
      description: `[${tool.serverName}] ${tool.description}`,
      serverName: tool.serverName,
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Get detailed tools with full schemas.
 *
 * Per-agent filtering:
 * - MCP tools: only from MCP servers enabled for this agent (via ai_agent_capabilities)
 * - Memory tools: FEATURE_SOUL_MEMORY=true or agent.features.soulMemory=true
 * - Deep tools: FEATURE_DEEP_TOOLS!=false or agent.features.deepTools!=false (default ON)
 */
export async function getDetailedToolsForAgent(agentId: string): Promise<Tool[]> {
  const tools: Tool[] = [];
  const features = getFeatureFlags();

  // Load per-agent feature overrides
  let agentFeatures: Record<string, any> = {};
  try {
    const { db } = await import('../db/client');
    const { agents } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (rows[0]?.features && typeof rows[0].features === 'object') {
      agentFeatures = rows[0].features as Record<string, any>;
    }
  } catch {}

  // Merge: agent-level overrides take precedence over global flags
  const effectiveFeatures = {
    soulMemory: agentFeatures.soulMemory ?? features.soulMemory,
    deepTools: agentFeatures.deepTools ?? features.deepTools,
  };

  // ══════════════════════════════════════════════════════════════════════
  // MCP Server Tools (one-tool-per-server pattern)
  //
  // Only include tools from MCP servers that are ENABLED for this agent.
  // ══════════════════════════════════════════════════════════════════════

  // Get this agent's enabled capabilities
  let enabledServerNames: Set<string> | null = null;
  try {
    const { db } = await import('../db/client');
    const { agentCapabilities } = await import('../db/schema');
    const { eq, and } = await import('drizzle-orm');
    const enabledCaps = await db
      .select()
      .from(agentCapabilities)
      .where(and(eq(agentCapabilities.agentId, agentId), eq(agentCapabilities.enabled, 1)));

    if (enabledCaps.length > 0) {
      enabledServerNames = new Set(enabledCaps.map((c: any) => c.capabilityId));
    }
  } catch {}

  try {
    const { getOrchestrator } = await import('../mcp-hub/orchestrator');
    const orchestrator = getOrchestrator();
    const registry = orchestrator.serverRegistry;
    const allMcpTools = registry.getAllTools();

    // Group tools by server
    const toolsByServer = new Map<string, typeof allMcpTools>();
    for (const tool of allMcpTools) {
      const existing = toolsByServer.get(tool.serverName) || [];
      existing.push(tool);
      toolsByServer.set(tool.serverName, existing);
    }

    console.log('[tool-executor] MCP servers with tools:', Array.from(toolsByServer.keys()).join(', '));
    if (enabledServerNames) {
      console.log('[tool-executor] Agent', agentId, 'enabled capabilities:', Array.from(enabledServerNames).join(', '));
    }

    // Create ONE tool per MCP server (filtered by agent capabilities)
    for (const [serverName, serverTools] of toolsByServer) {
      // Skip servers not enabled for this agent (if agent has any capability records)
      if (enabledServerNames !== null) {
        // Check if this server matches any enabled capability
        const serverKey = serverName.toLowerCase().replace(/\s+/g, '-');
        if (!enabledServerNames.has(serverKey) && !enabledServerNames.has(serverName)) {
          continue;
        }
      }
      const actionNames = serverTools.map((t) => t.name);

      const actionDescriptions = serverTools
        .map((t) => {
          const desc = t.description.length > 60 ? t.description.slice(0, 57) + '...' : t.description;
          return `  - ${t.name}: ${desc}`;
        })
        .join('\n');

      tools.push({
        name: `mcp__${serverName}`,
        description: `[MCP: ${serverName}] Execute an action on this service.\n\nAvailable actions:\n${actionDescriptions}`,
        serverName,
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: `Action to execute. One of: ${actionNames.join(', ')}`,
              enum: actionNames,
            },
            params: {
              type: 'object',
              description: 'Parameters for the action (varies by action). Pass relevant key-value pairs.',
            },
          },
          required: ['action'],
        },
      });
    }

    console.log('[tool-executor] Total MCP server tools:', toolsByServer.size, '(from', allMcpTools.length, 'individual methods)');
  } catch (err) {
    console.warn('[tool-executor] MCP Hub not available, skipping MCP tools');
  }

  // Add memory tools if enabled (global or per-agent)
  if (effectiveFeatures.soulMemory) {
    try {
      const { MEMORY_TOOLS } = await import('../memory/memoryTools');
      tools.push(...MEMORY_TOOLS);
      console.log('[tool-executor] Added memory tools:', MEMORY_TOOLS.map((t) => t.name).join(', '));
    } catch {
      console.warn('[tool-executor] Memory tools module not available');
    }
  }

  // Add deep tools if enabled (global or per-agent, default ON)
  if (effectiveFeatures.deepTools) {
    try {
      const { DEEP_TOOLS } = await import('../tools/deepTools');
      tools.push(...DEEP_TOOLS);
      console.log('[tool-executor] Added deep tools:', DEEP_TOOLS.map((t) => t.name).join(', '));
    } catch {
      console.warn('[tool-executor] Deep tools module not available');
    }
  }

  return tools;
}

/**
 * Execute a single tool call via the MCP Hub
 */
async function executeMcpTool(
  serverName: string,
  toolName: string,
  input: Record<string, unknown>,
  agentId?: string
): Promise<{ success: boolean; output: string }> {
  try {
    const { getOrchestrator } = await import('../mcp-hub/orchestrator');
    const orchestrator = getOrchestrator();
    const context = agentId ? { agentId } : undefined;
    const result = await orchestrator.executeAction(serverName, toolName, input, context);

    if (result.success) {
      return {
        success: true,
        output: typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2),
      };
    } else {
      return {
        success: false,
        output: result.error || 'Tool execution failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Parse a namespaced tool name (server__toolname) into its components
 */
function parseNamespacedTool(namespacedName: string): { serverName: string; toolName: string } | null {
  const parts = namespacedName.split('__');
  if (parts.length !== 2) {
    return null;
  }
  return { serverName: parts[0]!, toolName: parts[1]! };
}

/**
 * Execute a full conversation with tool calling loop
 */
export async function executeWithTools(
  messages: LLMMessage[],
  options: ToolExecutorOptions
): Promise<ToolExecutorResult> {
  const provider = getProviderForModel(options.model);
  const toolsUsed: ToolExecutorResult['toolsUsed'] = [];

  // Get available tools if enabled
  let tools: Tool[] = [];
  if (options.enableTools !== false) {
    tools = await getDetailedToolsForAgent(options.agentId);
  }

  // If no tools available, just do a simple generation
  if (tools.length === 0) {
    const generateOpts: GenerateOptions = {
      model: options.model,
      agentId: options.agentId,
    };
    if (options.maxTokens !== undefined) {
      generateOpts.maxTokens = options.maxTokens;
    }
    const reply = await provider.generate(messages, generateOpts);
    return { reply, toolsUsed: [] };
  }

  // Tool calling loop
  let currentMessages = [...messages];
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    // Call LLM with tools
    const toolOpts: GenerateOptions = {
      model: options.model,
      agentId: options.agentId,
      tools,
    };
    if (options.maxTokens !== undefined) {
      toolOpts.maxTokens = options.maxTokens;
    }
    const result = await provider.generateWithTools(currentMessages, toolOpts);

    // If we got a text response, we're done
    if (result.type === 'text' || !result.toolCalls || result.toolCalls.length === 0) {
      return { reply: result.text || '', toolsUsed };
    }

    // Execute each tool call
    const toolResultMessages: LLMMessage[] = [];

    for (const toolCall of result.toolCalls) {
      // Notify caller about tool execution (for streaming progress)
      if (options.onToolCall) {
        // For MCP server tools, show the actual action name instead of the wrapper
        const displayName = toolCall.name.startsWith('mcp__') && toolCall.input.action
          ? String(toolCall.input.action)
          : toolCall.name;
        options.onToolCall(displayName);
      }

      const MAX_OUTPUT = 20000;

      // Check if this is a memory tool
      if (toolCall.name.startsWith('memory__')) {
        try {
          const { isMemoryTool, executeMemoryTool } = await import('../memory/memoryTools');
          if (isMemoryTool(toolCall.name)) {
            const memResult = await executeMemoryTool(options.agentId, toolCall);

            let output = memResult.output;
            if (output.length > MAX_OUTPUT) {
              output = output.slice(0, MAX_OUTPUT) + '\n\n[OUTPUT TRUNCATED]';
            }

            toolResultMessages.push({
              role: 'tool',
              content: output,
              toolCallId: toolCall.id,
            });
            toolsUsed.push({
              name: toolCall.name,
              input: toolCall.input,
              output,
              success: memResult.success,
            });
            continue;
          }
        } catch {
          // Memory tools not available
        }
      }

      // Check if this is a deep tool (web__search, web__fetch, data__export_csv)
      if (toolCall.name.startsWith('web__') || toolCall.name.startsWith('data__')) {
        try {
          const { isDeepTool, executeDeepTool } = await import('../tools/deepTools');
          if (isDeepTool(toolCall.name)) {
            const deepResult = await executeDeepTool(toolCall, options.agentId);

            let output = deepResult.output;
            if (output.length > MAX_OUTPUT) {
              output = output.slice(0, MAX_OUTPUT) + '\n\n[OUTPUT TRUNCATED]';
            }

            toolResultMessages.push({
              role: 'tool',
              content: output,
              toolCallId: toolCall.id,
            });
            toolsUsed.push({
              name: toolCall.name,
              input: toolCall.input,
              output,
              success: deepResult.success,
            });
            continue;
          }
        } catch {
          // Deep tools not available
        }
      }

      // ════════════════════════════════════════════════════════════════
      // MCP Server Tools (one-tool-per-server pattern)
      //
      // Tool name format: mcp__<serverName>
      // Input: { action: "tool_name", params: { ... } }
      // Routes to: orchestrator.executeAction(serverName, action, params)
      // ════════════════════════════════════════════════════════════════
      if (toolCall.name.startsWith('mcp__')) {
        const serverName = toolCall.name.replace('mcp__', '');
        const action = toolCall.input.action as string;
        const params = (toolCall.input.params as Record<string, unknown>) || {};

        if (!action) {
          toolResultMessages.push({
            role: 'tool',
            content: 'Error: Missing "action" parameter. Specify which action to execute.',
            toolCallId: toolCall.id,
          });
          toolsUsed.push({
            name: toolCall.name,
            input: toolCall.input,
            output: 'Missing action parameter',
            success: false,
          });
          continue;
        }

        console.log(`[tool-executor] MCP call: ${serverName}.${action} (agent: ${options.agentId})`, JSON.stringify(params).slice(0, 200));
        const toolResult = await executeMcpTool(serverName, action, params, options.agentId);

        // Truncate large outputs
        let truncatedOutput = toolResult.output;
        if (truncatedOutput.length > MAX_OUTPUT) {
          truncatedOutput = truncatedOutput.slice(0, MAX_OUTPUT) + '\n\n[OUTPUT TRUNCATED]';
          console.log(`[tool-executor] Truncated output for ${serverName}.${action}: ${toolResult.output.length} -> ${truncatedOutput.length} chars`);
        }

        toolResultMessages.push({
          role: 'tool',
          content: truncatedOutput,
          toolCallId: toolCall.id,
        });
        toolsUsed.push({
          name: `${serverName}.${action}`,
          input: params,
          output: truncatedOutput,
          success: toolResult.success,
        });
        continue;
      }

      // ════════════════════════════════════════════════════════════════
      // Legacy: direct server__toolname format (backward compat)
      // ════════════════════════════════════════════════════════════════
      const parsed = parseNamespacedTool(toolCall.name);

      if (!parsed) {
        toolResultMessages.push({
          role: 'tool',
          content: `Error: Tool '${toolCall.name}' not found. Available tool prefixes: memory__, mcp__, web__`,
          toolCallId: toolCall.id,
        });
        toolsUsed.push({
          name: toolCall.name,
          input: toolCall.input,
          output: 'Tool not found',
          success: false,
        });
        continue;
      }

      // Execute with the actual tool name (not namespaced)
      const toolResult = await executeMcpTool(parsed.serverName, parsed.toolName, toolCall.input, options.agentId);

      let truncatedOutput = toolResult.output;
      if (truncatedOutput.length > MAX_OUTPUT) {
        truncatedOutput = truncatedOutput.slice(0, MAX_OUTPUT) + '\n\n[OUTPUT TRUNCATED]';
      }

      toolResultMessages.push({
        role: 'tool',
        content: truncatedOutput,
        toolCallId: toolCall.id,
      });
      toolsUsed.push({
        name: toolCall.name,
        input: toolCall.input,
        output: truncatedOutput,
        success: toolResult.success,
      });
    }

    // Add assistant message with tool_use blocks (required by Claude API)
    currentMessages.push({
      role: 'assistant',
      content: result.text || '',
      toolCalls: result.toolCalls,
    });

    // Add tool results
    currentMessages = currentMessages.concat(toolResultMessages);
  }

  // If we hit max iterations, return what we have
  return {
    reply: 'I was unable to complete the task within the allowed number of tool calls.',
    toolsUsed,
  };
}
