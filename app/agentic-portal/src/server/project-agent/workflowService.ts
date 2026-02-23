import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { assertProjectAgent } from './projectAgentService';
import { runProjectAgentChat } from './chatService';

export interface WorkflowStep {
  sourceId?: string;
  message: string;
}

export interface WorkflowDefinition {
  steps: WorkflowStep[];
}

export interface CreateProjectWorkflowInput {
  projectId: string;
  organizationId: string;
  name: string;
  description?: string;
  enabled?: boolean;
  definition: WorkflowDefinition;
}

function validateDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  const steps = Array.isArray(definition?.steps) ? definition.steps : [];
  if (!steps.length) throw new Error('Workflow requires at least one step');
  const cleaned = steps
    .map((step) => ({
      sourceId: step.sourceId ? String(step.sourceId) : undefined,
      message: String(step.message || '').trim(),
    }))
    .filter((step) => step.message.length > 0);
  if (!cleaned.length) throw new Error('Workflow requires at least one valid step');
  if (cleaned.length > 20) throw new Error('Workflow supports up to 20 steps');
  return { steps: cleaned };
}

export async function listProjectWorkflows(projectId: string, organizationId: string) {
  await assertProjectAgent(projectId, organizationId);
  return db
    .select()
    .from(schema.projectDataWorkflows)
    .where(and(eq(schema.projectDataWorkflows.projectId, projectId), eq(schema.projectDataWorkflows.organizationId, organizationId)))
    .orderBy(desc(schema.projectDataWorkflows.updatedAt));
}

export async function getProjectWorkflow(projectId: string, organizationId: string, workflowId: string) {
  await assertProjectAgent(projectId, organizationId);
  const rows = await db
    .select()
    .from(schema.projectDataWorkflows)
    .where(
      and(
        eq(schema.projectDataWorkflows.projectId, projectId),
        eq(schema.projectDataWorkflows.organizationId, organizationId),
        eq(schema.projectDataWorkflows.id, workflowId)
      )
    )
    .limit(1);
  return rows[0] || null;
}

export async function createProjectWorkflow(input: CreateProjectWorkflowInput) {
  await assertProjectAgent(input.projectId, input.organizationId);
  if (!input.name?.trim()) throw new Error('name is required');
  const definition = validateDefinition(input.definition);
  const id = `pdwf_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const now = new Date();
  const rows = await db
    .insert(schema.projectDataWorkflows)
    .values({
      id,
      projectId: input.projectId,
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      enabled: input.enabled === false ? 0 : 1,
      definition,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

export async function updateProjectWorkflow(input: {
  projectId: string;
  organizationId: string;
  workflowId: string;
  name?: string;
  description?: string;
  definition?: WorkflowDefinition;
}) {
  await assertProjectAgent(input.projectId, input.organizationId);
  const existing = await getProjectWorkflow(input.projectId, input.organizationId, input.workflowId);
  if (!existing) throw new Error('Workflow not found');
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.name === 'string') patch.name = input.name.trim();
  if (typeof input.description === 'string') patch.description = input.description.trim();
  if (input.definition) patch.definition = validateDefinition(input.definition);
  const rows = await db
    .update(schema.projectDataWorkflows)
    .set(patch)
    .where(
      and(
        eq(schema.projectDataWorkflows.projectId, input.projectId),
        eq(schema.projectDataWorkflows.organizationId, input.organizationId),
        eq(schema.projectDataWorkflows.id, input.workflowId)
      )
    )
    .returning();
  return rows[0];
}

export async function setProjectWorkflowEnabled(
  projectId: string,
  organizationId: string,
  workflowId: string,
  enabled: boolean
) {
  await assertProjectAgent(projectId, organizationId);
  const rows = await db
    .update(schema.projectDataWorkflows)
    .set({ enabled: enabled ? 1 : 0, updatedAt: new Date() })
    .where(
      and(
        eq(schema.projectDataWorkflows.projectId, projectId),
        eq(schema.projectDataWorkflows.organizationId, organizationId),
        eq(schema.projectDataWorkflows.id, workflowId)
      )
    )
    .returning();
  if (!rows[0]) throw new Error('Workflow not found');
  return rows[0];
}

export async function deleteProjectWorkflow(projectId: string, organizationId: string, workflowId: string) {
  await assertProjectAgent(projectId, organizationId);
  const existing = await getProjectWorkflow(projectId, organizationId, workflowId);
  if (!existing) throw new Error('Workflow not found');
  await db
    .delete(schema.projectDataWorkflows)
    .where(
      and(
        eq(schema.projectDataWorkflows.projectId, projectId),
        eq(schema.projectDataWorkflows.organizationId, organizationId),
        eq(schema.projectDataWorkflows.id, workflowId)
      )
    );
  return { id: workflowId };
}

export async function listProjectWorkflowRuns(projectId: string, organizationId: string, workflowId?: string, limit = 50) {
  await assertProjectAgent(projectId, organizationId);
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const base = db.select().from(schema.projectDataWorkflowRuns).$dynamic();
  const scoped = workflowId
    ? base.where(
        and(
          eq(schema.projectDataWorkflowRuns.projectId, projectId),
          eq(schema.projectDataWorkflowRuns.organizationId, organizationId),
          eq(schema.projectDataWorkflowRuns.workflowId, workflowId)
        )
      )
    : base.where(
        and(eq(schema.projectDataWorkflowRuns.projectId, projectId), eq(schema.projectDataWorkflowRuns.organizationId, organizationId))
      );
  return scoped.orderBy(desc(schema.projectDataWorkflowRuns.startedAt)).limit(safeLimit);
}

export async function getProjectWorkflowRun(projectId: string, organizationId: string, runId: string) {
  await assertProjectAgent(projectId, organizationId);
  const rows = await db
    .select()
    .from(schema.projectDataWorkflowRuns)
    .where(
      and(
        eq(schema.projectDataWorkflowRuns.projectId, projectId),
        eq(schema.projectDataWorkflowRuns.organizationId, organizationId),
        eq(schema.projectDataWorkflowRuns.id, runId)
      )
    )
    .limit(1);
  return rows[0] || null;
}

export async function runProjectWorkflow(input: {
  projectId: string;
  organizationId: string;
  workflowId: string;
  triggeredBy?: string;
}) {
  const workflow = await getProjectWorkflow(input.projectId, input.organizationId, input.workflowId);
  if (!workflow) throw new Error('Workflow not found');
  if (workflow.enabled !== 1) throw new Error('Workflow is disabled');

  const definition = validateDefinition((workflow.definition || { steps: [] }) as WorkflowDefinition);
  const runId = `pdwr_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  await db.insert(schema.projectDataWorkflowRuns).values({
    id: runId,
    workflowId: workflow.id,
    projectId: input.projectId,
    organizationId: input.organizationId,
    status: 'running',
    triggeredBy: input.triggeredBy || 'manual',
    input: { steps: definition.steps.length },
    startedAt: new Date(),
  });

  const outputs: Array<Record<string, unknown>> = [];
  try {
    for (const [index, step] of definition.steps.entries()) {
      const result = await runProjectAgentChat({
        projectId: input.projectId,
        organizationId: input.organizationId,
        sourceId: step.sourceId,
        message: step.message,
        workflowId: workflow.id,
        workflowRunId: runId,
      });
      outputs.push({
        step: index + 1,
        message: step.message,
        source: result.source,
        answer: result.answer,
        runId: result.runId || null,
        rowCount: result.trust.rowCount,
      });
    }

    const rows = await db
      .update(schema.projectDataWorkflowRuns)
      .set({
        status: 'succeeded',
        output: { steps: outputs },
        completedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectDataWorkflowRuns.id, runId),
          eq(schema.projectDataWorkflowRuns.projectId, input.projectId),
          eq(schema.projectDataWorkflowRuns.organizationId, input.organizationId)
        )
      )
      .returning();
    return rows[0];
  } catch (err: any) {
    const rows = await db
      .update(schema.projectDataWorkflowRuns)
      .set({
        status: 'failed',
        output: { steps: outputs },
        error: err?.message || 'Workflow failed',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectDataWorkflowRuns.id, runId),
          eq(schema.projectDataWorkflowRuns.projectId, input.projectId),
          eq(schema.projectDataWorkflowRuns.organizationId, input.organizationId)
        )
      )
      .returning();
    return rows[0];
  }
}
