import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { assertProjectAgent } from './projectAgentService';

export interface ProjectQueryRunCreateInput {
  projectId: string;
  organizationId: string;
  sourceId?: string;
  message: string;
  sqlText?: string;
  rowCount?: number;
  confidence?: number | null;
  reasoning?: string;
  answer?: string;
  resultSample?: Array<Record<string, unknown>>;
  status?: 'succeeded' | 'failed';
  error?: string;
  runType?: 'chat' | 'workflow';
  workflowId?: string;
  workflowRunId?: string;
}

function toConfidenceString(confidence?: number | null): string | null {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return null;
  return String(confidence);
}

export async function createProjectDataQueryRun(input: ProjectQueryRunCreateInput): Promise<string> {
  await assertProjectAgent(input.projectId, input.organizationId);
  const id = `pdqr_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const now = new Date();
  await db.insert(schema.projectDataQueryRuns).values({
    id,
    projectId: input.projectId,
    organizationId: input.organizationId,
    sourceId: input.sourceId || null,
    workflowId: input.workflowId || null,
    workflowRunId: input.workflowRunId || null,
    runType: input.runType || 'chat',
    message: input.message,
    status: input.status || 'succeeded',
    sqlText: input.sqlText || null,
    rowCount: Math.max(0, Number(input.rowCount || 0)),
    confidence: toConfidenceString(input.confidence),
    reasoning: input.reasoning || null,
    answer: input.answer || null,
    resultSample: input.resultSample || null,
    error: input.error || null,
    createdAt: now,
    completedAt: now,
  });
  return id;
}

export async function listProjectDataQueryRuns(projectId: string, organizationId: string, limit = 50) {
  await assertProjectAgent(projectId, organizationId);
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const rows = await db
    .select()
    .from(schema.projectDataQueryRuns)
    .where(and(eq(schema.projectDataQueryRuns.projectId, projectId), eq(schema.projectDataQueryRuns.organizationId, organizationId)))
    .orderBy(desc(schema.projectDataQueryRuns.createdAt))
    .limit(safeLimit);
  return rows.map((row: any) => ({
    ...row,
    confidence: row.confidence == null ? null : Number(row.confidence),
  }));
}

export async function getProjectDataQueryRun(projectId: string, organizationId: string, runId: string) {
  await assertProjectAgent(projectId, organizationId);
  const rows = await db
    .select()
    .from(schema.projectDataQueryRuns)
    .where(
      and(
        eq(schema.projectDataQueryRuns.projectId, projectId),
        eq(schema.projectDataQueryRuns.organizationId, organizationId),
        eq(schema.projectDataQueryRuns.id, runId)
      )
    )
    .limit(1);
  const row = rows[0] as any;
  if (!row) return null;
  return {
    ...row,
    confidence: row.confidence == null ? null : Number(row.confidence),
  };
}
