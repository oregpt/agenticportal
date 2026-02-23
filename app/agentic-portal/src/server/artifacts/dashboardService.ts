import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, schema } from '@/lib/db';
import { ensureProjectAgentTables } from '@/server/project-agent/bootstrap';

export async function addDashboardItem(input: {
  organizationId: string;
  dashboardArtifactId: string;
  childArtifactId: string;
  childArtifactVersionId?: string | null;
  positionJson?: Record<string, unknown> | null;
  displayJson?: Record<string, unknown> | null;
}) {
  await ensureProjectAgentTables();
  const [dashboard] = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.id, input.dashboardArtifactId), eq(schema.artifacts.organizationId, input.organizationId)))
    .limit(1);
  if (!dashboard || dashboard.type !== 'dashboard') throw new Error('Dashboard artifact not found');

  const [child] = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.id, input.childArtifactId), eq(schema.artifacts.organizationId, input.organizationId)))
    .limit(1);
  if (!child) throw new Error('Child artifact not found');

  const [row] = await db
    .insert(schema.dashboardItems)
    .values({
      id: randomUUID(),
      dashboardArtifactId: input.dashboardArtifactId,
      childArtifactId: input.childArtifactId,
      childArtifactVersionId: input.childArtifactVersionId || null,
      positionJson: input.positionJson || null,
      displayJson: input.displayJson || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateDashboardItem(input: {
  organizationId: string;
  dashboardArtifactId: string;
  itemId: string;
  childArtifactVersionId?: string | null;
  positionJson?: Record<string, unknown> | null;
  displayJson?: Record<string, unknown> | null;
}) {
  await ensureProjectAgentTables();
  const [dashboard] = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.id, input.dashboardArtifactId), eq(schema.artifacts.organizationId, input.organizationId)))
    .limit(1);
  if (!dashboard || dashboard.type !== 'dashboard') throw new Error('Dashboard artifact not found');

  const [existing] = await db
    .select()
    .from(schema.dashboardItems)
    .where(and(eq(schema.dashboardItems.id, input.itemId), eq(schema.dashboardItems.dashboardArtifactId, input.dashboardArtifactId)))
    .limit(1);
  if (!existing) throw new Error('Dashboard item not found');

  const [updated] = await db
    .update(schema.dashboardItems)
    .set({
      childArtifactVersionId: input.childArtifactVersionId !== undefined ? input.childArtifactVersionId : existing.childArtifactVersionId,
      positionJson: input.positionJson !== undefined ? input.positionJson : existing.positionJson,
      displayJson: input.displayJson !== undefined ? input.displayJson : existing.displayJson,
      updatedAt: new Date(),
    })
    .where(eq(schema.dashboardItems.id, existing.id))
    .returning();
  return updated;
}

export async function removeDashboardItem(input: {
  organizationId: string;
  dashboardArtifactId: string;
  itemId: string;
}) {
  await ensureProjectAgentTables();
  const [dashboard] = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.id, input.dashboardArtifactId), eq(schema.artifacts.organizationId, input.organizationId)))
    .limit(1);
  if (!dashboard || dashboard.type !== 'dashboard') throw new Error('Dashboard artifact not found');

  await db
    .delete(schema.dashboardItems)
    .where(and(eq(schema.dashboardItems.id, input.itemId), eq(schema.dashboardItems.dashboardArtifactId, input.dashboardArtifactId)));
  return { id: input.itemId };
}
