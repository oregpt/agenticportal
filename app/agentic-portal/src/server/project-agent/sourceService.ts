import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createDataSourceAdapter } from '@/lib/datasources';
import type { DataSourceConfig, DataSourceSchema } from '@/lib/datasources';
import type {
  ProjectAgentDataSource,
  ProjectAgentDataSourceConnectionTest,
  ProjectAgentDataSourceSchema,
  ProjectAgentSourceType,
} from './types';
import { assertProjectAgent } from './projectAgentService';
import { ensureProjectAgentTables } from './bootstrap';

function isProjectSourceType(type: string): type is ProjectAgentSourceType {
  return type === 'postgres' || type === 'bigquery' || type === 'google_sheets' || type === 'google_sheets_live';
}

function toAdapterConfig(row: typeof schema.dataSources.$inferSelect): DataSourceConfig {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    type: row.type as DataSourceConfig['type'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy || 'system',
    ...(row.config as Record<string, unknown>),
  } as DataSourceConfig;
}

function toProjectAgentSchema(input: DataSourceSchema): ProjectAgentDataSourceSchema {
  return {
    tables: (input.tables || []).map((t) => ({
      name: t.name,
      rowCount: t.rowCount,
      columns: (t.columns || []).map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
      })),
    })),
    lastRefreshed: input.lastRefreshed.toISOString(),
  };
}

function inferNotes(sourceName: string, sourceType: string, sourceSchema: ProjectAgentDataSourceSchema): string {
  const lines: string[] = [];
  lines.push(`Source: ${sourceName} (${sourceType})`);
  lines.push('Inferred from introspection:');
  for (const table of (sourceSchema.tables || []).slice(0, 12)) {
    const columns = (table.columns || []).slice(0, 20).map((c) => `${c.name}:${c.type}`).join(', ');
    lines.push(`- ${table.name}${columns ? ` -> ${columns}` : ''}`);
  }
  lines.push('Review and edit this draft with business meanings, key columns, and caveats.');
  return lines.join('\n');
}

async function ensureSourceMeta(row: typeof schema.dataSources.$inferSelect) {
  const [meta] = await db
    .select()
    .from(schema.projectAgentSourceMeta)
    .where(eq(schema.projectAgentSourceMeta.sourceId, row.id))
    .limit(1);

  if (meta) return meta;

  const now = new Date();
  const [created] = await db
    .insert(schema.projectAgentSourceMeta)
    .values({
      sourceId: row.id,
      projectId: row.workstreamId || '',
      organizationId: row.organizationId,
      status: 'active',
      userNotes: '',
      inferredNotes: '',
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created;
}

function mapWithMeta(
  row: typeof schema.dataSources.$inferSelect,
  meta: typeof schema.projectAgentSourceMeta.$inferSelect | null
): ProjectAgentDataSource {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.workstreamId || '',
    name: row.name,
    type: row.type as ProjectAgentSourceType,
    config: (row.config || {}) as Record<string, unknown>,
    schemaCache: (row.schemaCache || null) as Record<string, unknown> | null,
    status: (meta?.status || 'active') as ProjectAgentDataSource['status'],
    userNotes: meta?.userNotes || '',
    inferredNotes: meta?.inferredNotes || '',
    lastSyncedAt: meta?.lastSyncedAt || null,
    updatedAt: row.updatedAt,
  };
}

export async function listProjectDataSources(projectId: string, organizationId: string): Promise<ProjectAgentDataSource[]> {
  await ensureProjectAgentTables();
  await assertProjectAgent(projectId, organizationId);

  const rows = await db
    .select()
    .from(schema.dataSources)
    .where(
      and(
        eq(schema.dataSources.organizationId, organizationId),
        eq(schema.dataSources.workstreamId, projectId)
      )
    );

  const eligible = rows.filter((row) => isProjectSourceType(row.type));
  const sourceIds = eligible.map((row) => row.id);
  const metas = sourceIds.length
    ? await db
        .select()
        .from(schema.projectAgentSourceMeta)
        .where(inArray(schema.projectAgentSourceMeta.sourceId, sourceIds))
    : [];
  const metaMap = new Map(metas.map((meta) => [meta.sourceId, meta]));

  const output: ProjectAgentDataSource[] = [];
  for (const row of eligible) {
    const existingMeta = metaMap.get(row.id) || (await ensureSourceMeta(row));
    output.push(mapWithMeta(row, existingMeta));
  }
  return output;
}

export async function getProjectDataSourceById(
  projectId: string,
  organizationId: string,
  sourceId: string
): Promise<ProjectAgentDataSource | null> {
  await ensureProjectAgentTables();
  await assertProjectAgent(projectId, organizationId);

  const [row] = await db
    .select()
    .from(schema.dataSources)
    .where(
      and(
        eq(schema.dataSources.id, sourceId),
        eq(schema.dataSources.organizationId, organizationId),
        eq(schema.dataSources.workstreamId, projectId)
      )
    )
    .limit(1);

  if (!row || !isProjectSourceType(row.type)) return null;
  const [meta] = await db.select().from(schema.projectAgentSourceMeta).where(eq(schema.projectAgentSourceMeta.sourceId, row.id)).limit(1);
  return mapWithMeta(row, meta || (await ensureSourceMeta(row)));
}

export async function updateProjectSourceNotes(input: {
  projectId: string;
  organizationId: string;
  sourceId: string;
  userNotes: string;
}) {
  const source = await getProjectDataSourceById(input.projectId, input.organizationId, input.sourceId);
  if (!source) throw new Error('Data source not found');

  const now = new Date();
  await db
    .update(schema.projectAgentSourceMeta)
    .set({
      userNotes: input.userNotes || '',
      updatedAt: now,
    })
    .where(eq(schema.projectAgentSourceMeta.sourceId, source.id));

  return {
    id: source.id,
    userNotes: input.userNotes || '',
    inferredNotes: source.inferredNotes || '',
    updatedAt: now,
  };
}

export async function setProjectDataSourceEnabled(input: {
  projectId: string;
  organizationId: string;
  sourceId: string;
  enabled: boolean;
}) {
  const source = await getProjectDataSourceById(input.projectId, input.organizationId, input.sourceId);
  if (!source) throw new Error('Data source not found');

  const status = input.enabled ? 'active' : 'disabled';
  await db
    .update(schema.projectAgentSourceMeta)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.projectAgentSourceMeta.sourceId, source.id));
  return { id: source.id, status };
}

export async function testSavedProjectSource(input: {
  projectId: string;
  organizationId: string;
  sourceId: string;
}): Promise<ProjectAgentDataSourceConnectionTest> {
  const source = await getProjectDataSourceById(input.projectId, input.organizationId, input.sourceId);
  if (!source) throw new Error('Data source not found');

  const started = Date.now();
  const adapter = await createDataSourceAdapter({
    id: source.id,
    organizationId: source.organizationId,
    name: source.name,
    type: source.type,
    createdAt: source.updatedAt,
    updatedAt: source.updatedAt,
    createdBy: 'project-agent',
    ...(source.config || {}),
  } as DataSourceConfig);

  try {
    const result = await adapter.testConnection();
    await db
      .update(schema.projectAgentSourceMeta)
      .set({
        status: result.success ? 'active' : 'error',
        updatedAt: new Date(),
      })
      .where(eq(schema.projectAgentSourceMeta.sourceId, source.id));
    return {
      success: result.success,
      error: result.error,
      latencyMs: result.latencyMs ?? Date.now() - started,
    };
  } finally {
    await adapter.disconnect().catch(() => {});
  }
}

export async function introspectSavedProjectSource(input: {
  projectId: string;
  organizationId: string;
  sourceId: string;
}): Promise<{ schema: ProjectAgentDataSourceSchema; inferredNotes: string }> {
  const source = await getProjectDataSourceById(input.projectId, input.organizationId, input.sourceId);
  if (!source) throw new Error('Data source not found');

  const adapter = await createDataSourceAdapter({
    id: source.id,
    organizationId: source.organizationId,
    name: source.name,
    type: source.type,
    createdAt: source.updatedAt,
    updatedAt: source.updatedAt,
    createdBy: 'project-agent',
    ...(source.config || {}),
  } as DataSourceConfig);

  try {
    const sourceSchema = await adapter.getSchema();
    const schemaPayload = toProjectAgentSchema(sourceSchema);
    const inferredNotes = inferNotes(source.name, source.type, schemaPayload);
    const now = new Date();
    await db
      .update(schema.projectAgentSourceMeta)
      .set({
        status: 'active',
        inferredNotes,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.projectAgentSourceMeta.sourceId, source.id));
    return { schema: schemaPayload, inferredNotes };
  } finally {
    await adapter.disconnect().catch(() => {});
  }
}
