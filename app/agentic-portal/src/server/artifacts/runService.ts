import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, schema } from '@/lib/db';
import { createDataSourceAdapter } from '@/lib/datasources';
import type { DataSourceConfig } from '@/lib/datasources';
import { ensureProjectAgentTables } from '@/server/project-agent/bootstrap';
import { getArtifactById, getLatestArtifactVersion, listDashboardItems } from './artifactService';

async function createRun(input: {
  organizationId: string;
  projectId: string;
  artifactId: string;
  artifactVersionId?: string | null;
  querySpecId?: string | null;
  triggerType: 'chat' | 'manual' | 'api' | 'delivery';
  runInputJson?: Record<string, unknown> | null;
}) {
  const [row] = await db
    .insert(schema.artifactRuns)
    .values({
      id: randomUUID(),
      organizationId: input.organizationId,
      projectId: input.projectId,
      artifactId: input.artifactId,
      artifactVersionId: input.artifactVersionId || null,
      querySpecId: input.querySpecId || null,
      status: 'running',
      triggerType: input.triggerType,
      runInputJson: input.runInputJson || null,
      startedAt: new Date(),
    })
    .returning();
  return row;
}

async function completeRun(input: {
  id: string;
  status: 'succeeded' | 'failed';
  resultMetaJson?: Record<string, unknown> | null;
  resultSampleJson?: unknown;
  sqlTextSnapshot?: string | null;
  errorText?: string | null;
}) {
  const [row] = await db
    .update(schema.artifactRuns)
    .set({
      status: input.status,
      resultMetaJson: input.resultMetaJson || null,
      resultSampleJson: input.resultSampleJson || null,
      sqlTextSnapshot: input.sqlTextSnapshot || null,
      errorText: input.errorText || null,
      completedAt: new Date(),
    })
    .where(eq(schema.artifactRuns.id, input.id))
    .returning();
  return row;
}

async function executeQuerySpec(input: {
  querySpecId: string;
  organizationId: string;
  sqlTextOverride?: string;
}) {
  const [spec] = await db
    .select()
    .from(schema.querySpecs)
    .where(and(eq(schema.querySpecs.id, input.querySpecId), eq(schema.querySpecs.organizationId, input.organizationId)))
    .limit(1);
  if (!spec) throw new Error('Query spec not found');

  const [source] = await db
    .select()
    .from(schema.dataSources)
    .where(and(eq(schema.dataSources.id, spec.sourceId), eq(schema.dataSources.organizationId, input.organizationId)))
    .limit(1);
  if (!source) throw new Error('Source not found for query spec');

  const adapter = await createDataSourceAdapter({
    id: source.id,
    organizationId: source.organizationId,
    name: source.name,
    type: source.type as any,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    createdBy: source.createdBy || 'artifact-runner',
    ...(source.config || {}),
  } as DataSourceConfig);

  try {
    const sqlText = input.sqlTextOverride || spec.sqlText;
    const result = await adapter.executeQuery(sqlText);
    return {
      sqlText,
      rowCount: result.rowCount || (result.rows || []).length,
      rows: result.rows || [],
      columns: result.columns || [],
      source: { id: source.id, name: source.name, type: source.type },
    };
  } finally {
    await adapter.disconnect().catch(() => {});
  }
}

export async function runArtifact(input: {
  organizationId: string;
  artifactId: string;
  triggerType?: 'chat' | 'manual' | 'api' | 'delivery';
}) {
  await ensureProjectAgentTables();
  const artifactBundle = await getArtifactById(input.artifactId, input.organizationId);
  if (!artifactBundle) throw new Error('Artifact not found');
  const { artifact, latestVersion } = artifactBundle;
  if (!latestVersion) throw new Error('Artifact has no version');

  const run = await createRun({
    organizationId: artifact.organizationId,
    projectId: artifact.projectId,
    artifactId: artifact.id,
    artifactVersionId: latestVersion.id,
    querySpecId: latestVersion.querySpecId || null,
    triggerType: input.triggerType || 'manual',
  });

  try {
    if (artifact.type === 'dashboard') {
      const items = await listDashboardItems(artifact.id);
      const children = [];
      for (const item of items) {
        const childRun = await runArtifact({
          organizationId: input.organizationId,
          artifactId: item.childArtifactId,
          triggerType: input.triggerType || 'manual',
        });
        children.push({
          itemId: item.id,
          childArtifactId: item.childArtifactId,
          runId: childRun.run.id,
          status: childRun.run.status,
          rowCount: Number((childRun.run.resultMetaJson as any)?.rowCount || 0),
        });
      }
      const completed = await completeRun({
        id: run.id,
        status: 'succeeded',
        resultMetaJson: {
          type: 'dashboard',
          childCount: children.length,
          children,
        },
        resultSampleJson: children.slice(0, 12),
      });
      return { run: completed, artifact };
    }

    if (!latestVersion.querySpecId) throw new Error('Artifact version has no query spec');
    const queryResult = await executeQuerySpec({
      querySpecId: latestVersion.querySpecId,
      organizationId: input.organizationId,
    });
    const completed = await completeRun({
      id: run.id,
      status: 'succeeded',
      sqlTextSnapshot: queryResult.sqlText,
      resultMetaJson: {
        rowCount: queryResult.rowCount,
        columnCount: queryResult.columns.length,
        source: queryResult.source,
      },
      resultSampleJson: queryResult.rows.slice(0, 50),
    });
    return { run: completed, artifact };
  } catch (err: any) {
    const failed = await completeRun({
      id: run.id,
      status: 'failed',
      errorText: err?.message || 'Artifact run failed',
    });
    throw new Error(failed.errorText || 'Artifact run failed');
  }
}

export async function listArtifactRuns(input: {
  organizationId: string;
  projectId?: string;
  artifactId?: string;
  limit?: number;
}) {
  await ensureProjectAgentTables();
  const clauses = [eq(schema.artifactRuns.organizationId, input.organizationId)];
  if (input.projectId) clauses.push(eq(schema.artifactRuns.projectId, input.projectId));
  if (input.artifactId) clauses.push(eq(schema.artifactRuns.artifactId, input.artifactId));

  const rows = await db
    .select()
    .from(schema.artifactRuns)
    .where(and(...clauses))
    .orderBy(desc(schema.artifactRuns.startedAt))
    .limit(Math.max(1, Math.min(Number(input.limit || 50), 200)));
  return rows;
}

export async function getArtifactRunById(id: string, organizationId: string) {
  await ensureProjectAgentTables();
  const [row] = await db
    .select()
    .from(schema.artifactRuns)
    .where(and(eq(schema.artifactRuns.id, id), eq(schema.artifactRuns.organizationId, organizationId)))
    .limit(1);
  return row || null;
}
