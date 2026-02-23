import crypto from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { assertProjectAgent } from './projectAgentService';

export interface CreateProjectMemoryRuleInput {
  projectId: string;
  organizationId: string;
  sourceId?: string;
  name: string;
  ruleText: string;
  priority?: number;
  enabled?: boolean;
}

export interface UpdateProjectMemoryRuleInput {
  projectId: string;
  organizationId: string;
  ruleId: string;
  name?: string;
  ruleText?: string;
  priority?: number;
  sourceId?: string | null;
}

export async function listProjectMemoryRules(projectId: string, organizationId: string) {
  await assertProjectAgent(projectId, organizationId);
  return db
    .select()
    .from(schema.projectDataMemoryRules)
    .where(and(eq(schema.projectDataMemoryRules.projectId, projectId), eq(schema.projectDataMemoryRules.organizationId, organizationId)))
    .orderBy(asc(schema.projectDataMemoryRules.priority), asc(schema.projectDataMemoryRules.createdAt));
}

export async function createProjectMemoryRule(input: CreateProjectMemoryRuleInput) {
  await assertProjectAgent(input.projectId, input.organizationId);
  if (!input.name?.trim()) throw new Error('name is required');
  if (!input.ruleText?.trim()) throw new Error('ruleText is required');
  const id = `pdmr_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const now = new Date();
  const rows = await db
    .insert(schema.projectDataMemoryRules)
    .values({
      id,
      projectId: input.projectId,
      organizationId: input.organizationId,
      sourceId: input.sourceId || null,
      name: input.name.trim(),
      ruleText: input.ruleText.trim(),
      priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 100,
      enabled: input.enabled === false ? 0 : 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

export async function updateProjectMemoryRule(input: UpdateProjectMemoryRuleInput) {
  await assertProjectAgent(input.projectId, input.organizationId);
  const existing = await db
    .select()
    .from(schema.projectDataMemoryRules)
    .where(
      and(
        eq(schema.projectDataMemoryRules.projectId, input.projectId),
        eq(schema.projectDataMemoryRules.organizationId, input.organizationId),
        eq(schema.projectDataMemoryRules.id, input.ruleId)
      )
    )
    .limit(1);
  if (!existing[0]) throw new Error('Memory rule not found');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.name === 'string') patch.name = input.name.trim();
  if (typeof input.ruleText === 'string') patch.ruleText = input.ruleText.trim();
  if (input.priority !== undefined) patch.priority = Number(input.priority);
  if (input.sourceId !== undefined) patch.sourceId = input.sourceId || null;

  const rows = await db
    .update(schema.projectDataMemoryRules)
    .set(patch)
    .where(
      and(
        eq(schema.projectDataMemoryRules.projectId, input.projectId),
        eq(schema.projectDataMemoryRules.organizationId, input.organizationId),
        eq(schema.projectDataMemoryRules.id, input.ruleId)
      )
    )
    .returning();
  return rows[0];
}

export async function setProjectMemoryRuleEnabled(
  projectId: string,
  organizationId: string,
  ruleId: string,
  enabled: boolean
) {
  await assertProjectAgent(projectId, organizationId);
  const rows = await db
    .update(schema.projectDataMemoryRules)
    .set({ enabled: enabled ? 1 : 0, updatedAt: new Date() })
    .where(
      and(
        eq(schema.projectDataMemoryRules.projectId, projectId),
        eq(schema.projectDataMemoryRules.organizationId, organizationId),
        eq(schema.projectDataMemoryRules.id, ruleId)
      )
    )
    .returning();
  if (!rows[0]) throw new Error('Memory rule not found');
  return rows[0];
}

export async function deleteProjectMemoryRule(projectId: string, organizationId: string, ruleId: string) {
  await assertProjectAgent(projectId, organizationId);
  const existing = await db
    .select()
    .from(schema.projectDataMemoryRules)
    .where(
      and(
        eq(schema.projectDataMemoryRules.projectId, projectId),
        eq(schema.projectDataMemoryRules.organizationId, organizationId),
        eq(schema.projectDataMemoryRules.id, ruleId)
      )
    )
    .limit(1);
  if (!existing[0]) throw new Error('Memory rule not found');
  await db
    .delete(schema.projectDataMemoryRules)
    .where(
      and(
        eq(schema.projectDataMemoryRules.projectId, projectId),
        eq(schema.projectDataMemoryRules.organizationId, organizationId),
        eq(schema.projectDataMemoryRules.id, ruleId)
      )
    );
  return { id: ruleId };
}

export async function listEnabledProjectMemoryRulesForChat(projectId: string, organizationId: string, sourceId?: string) {
  await assertProjectAgent(projectId, organizationId);
  const rows = await db
    .select()
    .from(schema.projectDataMemoryRules)
    .where(
      and(
        eq(schema.projectDataMemoryRules.projectId, projectId),
        eq(schema.projectDataMemoryRules.organizationId, organizationId),
        eq(schema.projectDataMemoryRules.enabled, 1)
      )
    )
    .orderBy(asc(schema.projectDataMemoryRules.priority), asc(schema.projectDataMemoryRules.createdAt));

  return rows.filter((row: any) => !row.sourceId || !sourceId || row.sourceId === sourceId);
}
