import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

let ensurePromise: Promise<void> | null = null;

export async function ensureDataSourceAssignmentTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS data_source_workstreams (
          id SERIAL PRIMARY KEY,
          data_source_id VARCHAR(64) NOT NULL,
          workstream_id VARCHAR(64) NOT NULL,
          organization_id VARCHAR(64) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ds_workstream_unique
        ON data_source_workstreams(data_source_id, workstream_id)
      `).catch(() => {});
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_ds_workstream_org_ws
        ON data_source_workstreams(organization_id, workstream_id)
      `).catch(() => {});
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_ds_workstream_org_ds
        ON data_source_workstreams(organization_id, data_source_id)
      `).catch(() => {});
    })();
  }
  return ensurePromise;
}

export async function getDataSourceIdsForWorkstream(
  organizationId: string,
  workstreamId: string
): Promise<string[]> {
  await ensureDataSourceAssignmentTable();
  const [assignedRows, legacyRows] = await Promise.all([
    db
      .select({ dataSourceId: schema.dataSourceWorkstreams.dataSourceId })
      .from(schema.dataSourceWorkstreams)
      .where(
        and(
          eq(schema.dataSourceWorkstreams.organizationId, organizationId),
          eq(schema.dataSourceWorkstreams.workstreamId, workstreamId)
        )
      ),
    db
      .select({ id: schema.dataSources.id })
      .from(schema.dataSources)
      .where(
        and(
          eq(schema.dataSources.organizationId, organizationId),
          eq(schema.dataSources.workstreamId, workstreamId)
        )
      ),
  ]);

  return Array.from(
    new Set([
      ...assignedRows.map((row) => row.dataSourceId),
      ...legacyRows.map((row) => row.id),
    ])
  );
}

export async function getAssignedWorkstreamIdsForSources(
  organizationId: string,
  dataSourceIds: string[]
): Promise<Map<string, string[]>> {
  await ensureDataSourceAssignmentTable();
  if (dataSourceIds.length === 0) {
    return new Map();
  }

  const [assignedRows, legacyRows] = await Promise.all([
    db
      .select({
        dataSourceId: schema.dataSourceWorkstreams.dataSourceId,
        workstreamId: schema.dataSourceWorkstreams.workstreamId,
      })
      .from(schema.dataSourceWorkstreams)
      .where(
        and(
          eq(schema.dataSourceWorkstreams.organizationId, organizationId),
          inArray(schema.dataSourceWorkstreams.dataSourceId, dataSourceIds)
        )
      ),
    db
      .select({
        id: schema.dataSources.id,
        workstreamId: schema.dataSources.workstreamId,
      })
      .from(schema.dataSources)
      .where(
        and(
          eq(schema.dataSources.organizationId, organizationId),
          inArray(schema.dataSources.id, dataSourceIds)
        )
      ),
  ]);

  const map = new Map<string, Set<string>>();
  for (const row of assignedRows) {
    if (!map.has(row.dataSourceId)) map.set(row.dataSourceId, new Set<string>());
    map.get(row.dataSourceId)?.add(row.workstreamId);
  }
  for (const row of legacyRows) {
    if (!row.workstreamId) continue;
    if (!map.has(row.id)) map.set(row.id, new Set<string>());
    map.get(row.id)?.add(row.workstreamId);
  }

  return new Map(Array.from(map.entries()).map(([k, set]) => [k, Array.from(set)]));
}

export async function replaceDataSourceAssignments(input: {
  organizationId: string;
  dataSourceId: string;
  workstreamIds: string[];
}) {
  await ensureDataSourceAssignmentTable();
  const uniqueIds = Array.from(new Set(input.workstreamIds.filter(Boolean)));

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.dataSourceWorkstreams)
      .where(
        and(
          eq(schema.dataSourceWorkstreams.organizationId, input.organizationId),
          eq(schema.dataSourceWorkstreams.dataSourceId, input.dataSourceId)
        )
      );

    if (uniqueIds.length > 0) {
      await tx.insert(schema.dataSourceWorkstreams).values(
        uniqueIds.map((workstreamId) => ({
          dataSourceId: input.dataSourceId,
          workstreamId,
          organizationId: input.organizationId,
          createdAt: new Date(),
        }))
      );
    }

    await tx
      .update(schema.dataSources)
      .set({
        workstreamId: uniqueIds[0] || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.dataSources.organizationId, input.organizationId),
          eq(schema.dataSources.id, input.dataSourceId)
        )
      );
  });

  return uniqueIds;
}

export async function clearAssignmentsForWorkstream(organizationId: string, workstreamId: string) {
  await ensureDataSourceAssignmentTable();
  await db
    .delete(schema.dataSourceWorkstreams)
    .where(
      and(
        eq(schema.dataSourceWorkstreams.organizationId, organizationId),
        eq(schema.dataSourceWorkstreams.workstreamId, workstreamId)
      )
    );
}

export async function clearAssignmentsForDataSource(organizationId: string, dataSourceId: string) {
  await ensureDataSourceAssignmentTable();
  await db
    .delete(schema.dataSourceWorkstreams)
    .where(
      and(
        eq(schema.dataSourceWorkstreams.organizationId, organizationId),
        eq(schema.dataSourceWorkstreams.dataSourceId, dataSourceId)
      )
    );
}
