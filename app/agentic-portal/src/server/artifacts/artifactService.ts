import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, schema } from '@/lib/db';
import type { ArtifactInput, ArtifactType, ArtifactVersionInput } from './types';
import { ensureProjectAgentTables } from '@/server/project-agent/bootstrap';

export async function createArtifact(input: ArtifactInput) {
  await ensureProjectAgentTables();
  const now = new Date();
  const id = randomUUID();
  const [row] = await db
    .insert(schema.artifacts)
    .values({
      id,
      organizationId: input.organizationId,
      projectId: input.projectId,
      type: input.type,
      name: input.name,
      description: input.description || null,
      status: 'active',
      latestVersion: 0,
      createdBy: input.createdBy || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function createArtifactVersion(input: ArtifactVersionInput) {
  await ensureProjectAgentTables();
  const [artifact] = await db
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.id, input.artifactId))
    .limit(1);
  if (!artifact) throw new Error('Artifact not found');

  const nextVersion = Number(artifact.latestVersion || 0) + 1;
  const [versionRow] = await db
    .insert(schema.artifactVersions)
    .values({
      id: randomUUID(),
      artifactId: artifact.id,
      version: nextVersion,
      querySpecId: input.querySpecId || null,
      configJson: input.configJson || null,
      layoutJson: input.layoutJson || null,
      notes: input.notes || null,
      createdBy: input.createdBy || null,
      createdAt: new Date(),
    })
    .returning();

  await db
    .update(schema.artifacts)
    .set({
      latestVersion: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(schema.artifacts.id, artifact.id));

  return versionRow;
}

export async function createArtifactWithVersion(input: {
  organizationId: string;
  projectId: string;
  type: ArtifactType;
  name: string;
  description?: string | null;
  querySpecId?: string | null;
  configJson?: Record<string, unknown> | null;
  layoutJson?: Record<string, unknown> | null;
  notes?: string | null;
  createdBy?: string | null;
}) {
  const artifact = await createArtifact({
    organizationId: input.organizationId,
    projectId: input.projectId,
    type: input.type,
    name: input.name,
    description: input.description,
    createdBy: input.createdBy,
  });

  const version = await createArtifactVersion({
    artifactId: artifact.id,
    querySpecId: input.querySpecId || null,
    configJson: input.configJson || null,
    layoutJson: input.layoutJson || null,
    notes: input.notes || null,
    createdBy: input.createdBy,
  });

  return { artifact, version };
}

export async function listArtifacts(input: {
  organizationId: string;
  projectId?: string;
  type?: ArtifactType;
  includeArchived?: boolean;
}) {
  await ensureProjectAgentTables();
  const clauses = [eq(schema.artifacts.organizationId, input.organizationId)];
  if (input.projectId) clauses.push(eq(schema.artifacts.projectId, input.projectId));
  if (input.type) clauses.push(eq(schema.artifacts.type, input.type));
  if (!input.includeArchived) clauses.push(eq(schema.artifacts.status, 'active'));

  const rows = await db
    .select({
      id: schema.artifacts.id,
      organizationId: schema.artifacts.organizationId,
      projectId: schema.artifacts.projectId,
      type: schema.artifacts.type,
      name: schema.artifacts.name,
      description: schema.artifacts.description,
      status: schema.artifacts.status,
      latestVersion: schema.artifacts.latestVersion,
      createdAt: schema.artifacts.createdAt,
      updatedAt: schema.artifacts.updatedAt,
      createdBy: schema.artifacts.createdBy,
    })
    .from(schema.artifacts)
    .where(and(...clauses))
    .orderBy(desc(schema.artifacts.updatedAt));

  return rows;
}

export async function getArtifactById(artifactId: string, organizationId: string) {
  await ensureProjectAgentTables();
  const [artifact] = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.id, artifactId), eq(schema.artifacts.organizationId, organizationId)))
    .limit(1);
  if (!artifact) return null;

  const versions = await db
    .select()
    .from(schema.artifactVersions)
    .where(eq(schema.artifactVersions.artifactId, artifact.id))
    .orderBy(desc(schema.artifactVersions.version));

  const latestVersion = versions[0] || null;
  return { artifact, versions, latestVersion };
}

export async function updateArtifact(input: {
  artifactId: string;
  organizationId: string;
  name?: string;
  description?: string | null;
  status?: 'active' | 'archived';
}) {
  await ensureProjectAgentTables();
  const [existing] = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.id, input.artifactId), eq(schema.artifacts.organizationId, input.organizationId)))
    .limit(1);
  if (!existing) return null;

  const [updated] = await db
    .update(schema.artifacts)
    .set({
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      status: input.status ?? existing.status,
      updatedAt: new Date(),
    })
    .where(eq(schema.artifacts.id, existing.id))
    .returning();
  return updated;
}

export async function deleteArtifact(input: {
  artifactId: string;
  organizationId: string;
}) {
  await ensureProjectAgentTables();
  const [artifact] = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.id, input.artifactId), eq(schema.artifacts.organizationId, input.organizationId)))
    .limit(1);
  if (!artifact) return null;

  const versions = await db
    .select({
      id: schema.artifactVersions.id,
      querySpecId: schema.artifactVersions.querySpecId,
    })
    .from(schema.artifactVersions)
    .where(eq(schema.artifactVersions.artifactId, artifact.id));

  // Remove dashboard composition links where artifact is either the dashboard container or a child block.
  await db
    .delete(schema.dashboardItems)
    .where(eq(schema.dashboardItems.dashboardArtifactId, artifact.id));

  await db
    .delete(schema.dashboardItems)
    .where(eq(schema.dashboardItems.childArtifactId, artifact.id));

  await db
    .delete(schema.artifactRuns)
    .where(eq(schema.artifactRuns.artifactId, artifact.id));

  const deliveryChannelRows = await db
    .select({ id: schema.deliveryChannels.id })
    .from(schema.deliveryChannels)
    .where(eq(schema.deliveryChannels.artifactId, artifact.id));
  const deliveryChannelIds = deliveryChannelRows.map((row) => row.id);
  if (deliveryChannelIds.length > 0) {
    for (const channelId of deliveryChannelIds) {
      await db.delete(schema.deliveryRuns).where(eq(schema.deliveryRuns.channelId, channelId));
    }
    await db.delete(schema.deliveryChannels).where(eq(schema.deliveryChannels.artifactId, artifact.id));
  }

  await db
    .delete(schema.artifactVersions)
    .where(eq(schema.artifactVersions.artifactId, artifact.id));

  await db
    .delete(schema.artifacts)
    .where(eq(schema.artifacts.id, artifact.id));

  const querySpecIds = Array.from(
    new Set(
      versions
        .map((v) => String(v.querySpecId || '').trim())
        .filter(Boolean)
    )
  );

  // Cleanup query specs only when no remaining artifact versions reference them.
  for (const querySpecId of querySpecIds) {
    const [usage] = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(schema.artifactVersions)
      .where(eq(schema.artifactVersions.querySpecId, querySpecId));
    if (Number(usage?.count || 0) === 0) {
      await db.delete(schema.querySpecs).where(eq(schema.querySpecs.id, querySpecId));
    }
  }

  return { id: artifact.id };
}

export async function listArtifactVersions(artifactId: string, organizationId: string) {
  await ensureProjectAgentTables();
  const [artifact] = await db
    .select({ id: schema.artifacts.id })
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.id, artifactId), eq(schema.artifacts.organizationId, organizationId)))
    .limit(1);
  if (!artifact) throw new Error('Artifact not found');
  return db
    .select()
    .from(schema.artifactVersions)
    .where(eq(schema.artifactVersions.artifactId, artifactId))
    .orderBy(desc(schema.artifactVersions.version));
}

export async function getLatestArtifactVersion(artifactId: string) {
  const [row] = await db
    .select()
    .from(schema.artifactVersions)
    .where(eq(schema.artifactVersions.artifactId, artifactId))
    .orderBy(desc(schema.artifactVersions.version))
    .limit(1);
  return row || null;
}

export async function getArtifactStats(organizationId: string, projectId?: string) {
  await ensureProjectAgentTables();
  const clauses = [eq(schema.artifacts.organizationId, organizationId)];
  if (projectId) clauses.push(eq(schema.artifacts.projectId, projectId));
  const [row] = await db
    .select({
      total: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(schema.artifacts)
    .where(and(...clauses));
  return { total: Number(row?.total || 0) };
}

export async function listDashboardItems(dashboardArtifactId: string) {
  return db
    .select()
    .from(schema.dashboardItems)
    .where(eq(schema.dashboardItems.dashboardArtifactId, dashboardArtifactId))
    .orderBy(asc(schema.dashboardItems.createdAt));
}
