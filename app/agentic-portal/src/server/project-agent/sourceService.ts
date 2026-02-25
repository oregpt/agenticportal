import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createDataSourceAdapter } from '@/lib/datasources';
import type { DataSourceConfig, DataSourceSchema } from '@/lib/datasources';
import { buildMcpSchemaCache, testMcpSourceConfig } from '@/server/mcp/testing';
import { isMcpProviderId } from '@/server/mcp/providers';
import type {
  ProjectAgentDataSource,
  ProjectAgentDataSourceConnectionTest,
  ProjectAgentDataSourceSchema,
  ProjectAgentSourceType,
} from './types';
import { assertProjectAgent } from './projectAgentService';
import { ensureProjectAgentTables } from './bootstrap';
import { getDataSourceIdsForWorkstream } from '@/server/datasource-assignments';

function isProjectSourceType(type: string): type is ProjectAgentSourceType {
  return type === 'postgres' || type === 'bigquery' || type === 'google_sheets' || type === 'google_sheets_live' || type === 'mcp_server';
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
  meta: typeof schema.projectAgentSourceMeta.$inferSelect | null,
  projectId: string
): ProjectAgentDataSource {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId,
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

  const sourceIds = await getDataSourceIdsForWorkstream(organizationId, projectId);
  if (sourceIds.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.dataSources)
    .where(
      and(
        eq(schema.dataSources.organizationId, organizationId),
        inArray(schema.dataSources.id, sourceIds)
      )
    );

  const eligible = rows.filter((row) => isProjectSourceType(row.type));
  const eligibleSourceIds = eligible.map((row) => row.id);
  const metas = eligibleSourceIds.length
    ? await db
        .select()
        .from(schema.projectAgentSourceMeta)
        .where(inArray(schema.projectAgentSourceMeta.sourceId, eligibleSourceIds))
    : [];
  const metaMap = new Map(metas.map((meta) => [meta.sourceId, meta]));

  const output: ProjectAgentDataSource[] = [];
  for (const row of eligible) {
    const existingMeta = metaMap.get(row.id) || (await ensureSourceMeta(row));
    output.push(mapWithMeta(row, existingMeta, projectId));
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

  const allowedIds = await getDataSourceIdsForWorkstream(organizationId, projectId);
  if (!allowedIds.includes(sourceId)) return null;

  const [row] = await db
    .select()
    .from(schema.dataSources)
    .where(
      and(
        eq(schema.dataSources.id, sourceId),
        eq(schema.dataSources.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row || !isProjectSourceType(row.type)) return null;
  const [meta] = await db.select().from(schema.projectAgentSourceMeta).where(eq(schema.projectAgentSourceMeta.sourceId, row.id)).limit(1);
  return mapWithMeta(row, meta || (await ensureSourceMeta(row)), projectId);
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

  if (source.type === 'mcp_server') {
    const config = (source.config || {}) as Record<string, unknown>;
    const provider = String(config.provider || '').trim();
    const credentials = (config.credentials || {}) as Record<string, string>;
    if (!isMcpProviderId(provider)) {
      return { success: false, latencyMs: 0, error: 'Unsupported MCP provider in source config' };
    }
    const result = await testMcpSourceConfig({ provider, credentials });
    return {
      success: result.success,
      latencyMs: 0,
      message: result.message,
      error: result.error,
    };
  }

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

  if (source.type === 'mcp_server') {
    const config = (source.config || {}) as Record<string, unknown>;
    const provider = String(config.provider || '').trim();
    if (!isMcpProviderId(provider)) throw new Error('Unsupported MCP provider in source config');
    const payload = await buildMcpSchemaCache(provider);
    const schemaPayload: ProjectAgentDataSourceSchema = {
      tables: payload.tables.map((table) => ({
        name: table.name,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          nullable: column.nullable,
        })),
      })),
      lastRefreshed: new Date().toISOString(),
    };
    const inferredNotes = [
      `Source: ${source.name} (mcp_server/${provider})`,
      'Available MCP actions:',
      ...payload.tools.slice(0, 80).map((tool) => `- ${tool.name}: ${tool.description}`),
    ].join('\n');
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
  }

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
