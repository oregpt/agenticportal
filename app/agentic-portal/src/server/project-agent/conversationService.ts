import { and, asc, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, schema } from '@/lib/db';
import { ensureProjectAgentTables } from './bootstrap';

type ChatRole = 'user' | 'assistant';

export async function listProjectConversations(input: {
  projectId: string;
  organizationId: string;
  userId: string;
  limit?: number;
}) {
  await ensureProjectAgentTables();
  const rows = await db
    .select()
    .from(schema.projectAgentChatSessions)
    .where(
      and(
        eq(schema.projectAgentChatSessions.projectId, input.projectId),
        eq(schema.projectAgentChatSessions.organizationId, input.organizationId),
        eq(schema.projectAgentChatSessions.userId, input.userId),
      ),
    )
    .orderBy(desc(schema.projectAgentChatSessions.isPinned), desc(schema.projectAgentChatSessions.updatedAt))
    .limit(Math.max(1, Math.min(Number(input.limit || 100), 200)));

  const withCounts = await Promise.all(
    rows.map(async (session) => {
      const messages = await db
        .select({ id: schema.projectAgentChatMessages.id })
        .from(schema.projectAgentChatMessages)
        .where(eq(schema.projectAgentChatMessages.conversationId, session.id));
      return {
        ...session,
        messageCount: messages.length,
      };
    }),
  );

  return withCounts;
}

export async function createProjectConversation(input: {
  projectId: string;
  organizationId: string;
  userId: string;
  title: string;
}) {
  await ensureProjectAgentTables();
  const now = new Date();
  const [row] = await db
    .insert(schema.projectAgentChatSessions)
    .values({
      id: randomUUID(),
      projectId: input.projectId,
      organizationId: input.organizationId,
      userId: input.userId,
      title: String(input.title || 'New conversation').slice(0, 255),
      isPinned: 0,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function getProjectConversation(input: {
  conversationId: string;
  projectId: string;
  organizationId: string;
  userId: string;
}) {
  await ensureProjectAgentTables();
  const [conversation] = await db
    .select()
    .from(schema.projectAgentChatSessions)
    .where(
      and(
        eq(schema.projectAgentChatSessions.id, input.conversationId),
        eq(schema.projectAgentChatSessions.projectId, input.projectId),
        eq(schema.projectAgentChatSessions.organizationId, input.organizationId),
        eq(schema.projectAgentChatSessions.userId, input.userId),
      ),
    )
    .limit(1);
  if (!conversation) return null;

  const messages = await db
    .select()
    .from(schema.projectAgentChatMessages)
    .where(eq(schema.projectAgentChatMessages.conversationId, conversation.id))
    .orderBy(asc(schema.projectAgentChatMessages.createdAt));

  return { conversation, messages };
}

export async function appendProjectConversationMessages(input: {
  conversationId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  messages: Array<{ role: ChatRole; content: string; dataRunJson?: Record<string, unknown> | null }>;
}) {
  await ensureProjectAgentTables();
  const existing = await getProjectConversation({
    conversationId: input.conversationId,
    projectId: input.projectId,
    organizationId: input.organizationId,
    userId: input.userId,
  });
  if (!existing) throw new Error('Conversation not found');

  const now = new Date();
  const rows = input.messages
    .map((message) => ({
      id: randomUUID(),
      conversationId: input.conversationId,
      projectId: input.projectId,
      organizationId: input.organizationId,
      role: message.role,
      content: String(message.content || ''),
      dataRunJson: message.dataRunJson || null,
      createdAt: now,
    }))
    .filter((row) => row.content.trim().length > 0);

  if (rows.length > 0) {
    await db.insert(schema.projectAgentChatMessages).values(rows);
    await db
      .update(schema.projectAgentChatSessions)
      .set({
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(schema.projectAgentChatSessions.id, input.conversationId));
  }

  return getProjectConversation({
    conversationId: input.conversationId,
    projectId: input.projectId,
    organizationId: input.organizationId,
    userId: input.userId,
  });
}

export async function updateProjectConversationTitle(input: {
  conversationId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  title?: string;
  isPinned?: boolean;
}) {
  await ensureProjectAgentTables();
  const [row] = await db
    .update(schema.projectAgentChatSessions)
    .set({
      title: input.title === undefined ? undefined : String(input.title || 'Conversation').slice(0, 255),
      isPinned: input.isPinned === undefined ? undefined : input.isPinned ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.projectAgentChatSessions.id, input.conversationId),
        eq(schema.projectAgentChatSessions.projectId, input.projectId),
        eq(schema.projectAgentChatSessions.organizationId, input.organizationId),
        eq(schema.projectAgentChatSessions.userId, input.userId),
      ),
    )
    .returning();
  return row || null;
}

export async function deleteProjectConversation(input: {
  conversationId: string;
  projectId: string;
  organizationId: string;
  userId: string;
}) {
  await ensureProjectAgentTables();
  const existing = await getProjectConversation({
    conversationId: input.conversationId,
    projectId: input.projectId,
    organizationId: input.organizationId,
    userId: input.userId,
  });
  if (!existing) return null;

  await db.delete(schema.projectAgentChatMessages).where(eq(schema.projectAgentChatMessages.conversationId, input.conversationId));
  await db.delete(schema.projectAgentChatSessions).where(eq(schema.projectAgentChatSessions.id, input.conversationId));
  return { id: input.conversationId };
}
