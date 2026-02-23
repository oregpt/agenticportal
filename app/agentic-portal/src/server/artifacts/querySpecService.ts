import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, schema } from '@/lib/db';
import type { QuerySpecInput } from './types';
import { ensureProjectAgentTables } from '@/server/project-agent/bootstrap';

export async function createQuerySpec(input: QuerySpecInput) {
  await ensureProjectAgentTables();
  const now = new Date();
  const id = randomUUID();
  const [row] = await db
    .insert(schema.querySpecs)
    .values({
      id,
      organizationId: input.organizationId,
      projectId: input.projectId,
      sourceId: input.sourceId,
      name: input.name,
      sqlText: input.sqlText,
      parametersJson: input.parametersJson || null,
      metadataJson: input.metadataJson || null,
      createdBy: input.createdBy || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function listQuerySpecs(input: { organizationId: string; projectId?: string; sourceId?: string }) {
  await ensureProjectAgentTables();
  const clauses = [eq(schema.querySpecs.organizationId, input.organizationId)];
  if (input.projectId) clauses.push(eq(schema.querySpecs.projectId, input.projectId));
  if (input.sourceId) clauses.push(eq(schema.querySpecs.sourceId, input.sourceId));

  return db
    .select()
    .from(schema.querySpecs)
    .where(and(...clauses))
    .orderBy(desc(schema.querySpecs.updatedAt));
}

export async function getQuerySpecById(id: string, organizationId: string) {
  await ensureProjectAgentTables();
  const [row] = await db
    .select()
    .from(schema.querySpecs)
    .where(and(eq(schema.querySpecs.id, id), eq(schema.querySpecs.organizationId, organizationId)))
    .limit(1);
  return row || null;
}

export async function updateQuerySpec(input: {
  id: string;
  organizationId: string;
  name?: string;
  sqlText?: string;
  parametersJson?: Record<string, unknown> | null;
  metadataJson?: Record<string, unknown> | null;
}) {
  await ensureProjectAgentTables();
  const [existing] = await db
    .select()
    .from(schema.querySpecs)
    .where(and(eq(schema.querySpecs.id, input.id), eq(schema.querySpecs.organizationId, input.organizationId)))
    .limit(1);
  if (!existing) return null;

  const [updated] = await db
    .update(schema.querySpecs)
    .set({
      name: input.name ?? existing.name,
      sqlText: input.sqlText ?? existing.sqlText,
      parametersJson: input.parametersJson ?? existing.parametersJson,
      metadataJson: input.metadataJson ?? existing.metadataJson,
      updatedAt: new Date(),
    })
    .where(eq(schema.querySpecs.id, existing.id))
    .returning();
  return updated;
}
