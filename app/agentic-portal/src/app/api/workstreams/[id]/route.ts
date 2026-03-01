import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { ensureDataSourceAssignmentTable, getDataSourceIdsForWorkstream } from '@/server/datasource-assignments';
import { ensureProjectAgentTables } from '@/server/project-agent/bootstrap';

interface CachedColumn {
  name: string;
  type?: string;
  nullable?: boolean;
}

interface CachedTable {
  name: string;
  columns?: CachedColumn[];
}

interface DataSourceSchemaCache {
  tables?: CachedTable[];
}

function artifactTypeLabel(type: string) {
  if (type === 'kpi') return 'metric';
  if (type === 'report') return 'table';
  return type;
}

// GET /api/workstreams/[id] - Get workstream with all nodes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDataSourceAssignmentTable();
    await ensureProjectAgentTables();
    const { id: workstreamId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const orgId = user.organizationId || 'default-org';

    const [workstream] = await db
      .select()
      .from(schema.workstreams)
      .where(
        and(
          eq(schema.workstreams.id, workstreamId),
          eq(schema.workstreams.organizationId, orgId)
        )
      );

    if (!workstream) {
      return NextResponse.json({ error: 'Workstream not found' }, { status: 404 });
    }

    const dataSourceIds = await getDataSourceIdsForWorkstream(orgId, workstreamId);
    const dataSources = dataSourceIds.length
      ? await db
          .select({
            id: schema.dataSources.id,
            name: schema.dataSources.name,
            type: schema.dataSources.type,
            schemaCache: schema.dataSources.schemaCache,
            lastSyncedAt: schema.dataSources.lastSyncedAt,
          })
          .from(schema.dataSources)
          .where(
            and(
              eq(schema.dataSources.organizationId, orgId),
              inArray(schema.dataSources.id, dataSourceIds)
            )
          )
      : [];

    const artifacts = await db
      .select({
        id: schema.artifacts.id,
        type: schema.artifacts.type,
        name: schema.artifacts.name,
        description: schema.artifacts.description,
        status: schema.artifacts.status,
      })
      .from(schema.artifacts)
      .where(
        and(
          eq(schema.artifacts.organizationId, orgId),
          eq(schema.artifacts.projectId, workstreamId),
          eq(schema.artifacts.status, 'active')
        )
      );

    const [projectAgent] = await db
      .select({
        projectId: schema.projectAgents.projectId,
        agentName: schema.projectAgents.agentName,
        defaultModel: schema.projectAgents.defaultModel,
        updatedAt: schema.projectAgents.updatedAt,
      })
      .from(schema.projectAgents)
      .where(
        and(
          eq(schema.projectAgents.organizationId, orgId),
          eq(schema.projectAgents.projectId, workstreamId)
        )
      )
      .limit(1);

    const artifactIds = artifacts.map((artifact) => artifact.id);
    const artifactVersions = artifactIds.length
      ? await db
          .select({
            artifactId: schema.artifactVersions.artifactId,
            querySpecId: schema.artifactVersions.querySpecId,
            version: schema.artifactVersions.version,
          })
          .from(schema.artifactVersions)
          .where(inArray(schema.artifactVersions.artifactId, artifactIds))
      : [];

    const latestVersionByArtifactId = new Map<string, { querySpecId: string | null; version: number }>();
    for (const artifactVersion of artifactVersions) {
      const current = latestVersionByArtifactId.get(artifactVersion.artifactId);
      if (!current || artifactVersion.version > current.version) {
        latestVersionByArtifactId.set(artifactVersion.artifactId, {
          querySpecId: artifactVersion.querySpecId,
          version: artifactVersion.version,
        });
      }
    }

    const querySpecIds = Array.from(
      new Set(
        Array.from(latestVersionByArtifactId.values())
          .map((version) => version.querySpecId)
          .filter((id): id is string => Boolean(id))
      )
    );
    const querySpecs = querySpecIds.length
      ? await db
          .select({
            id: schema.querySpecs.id,
            sourceId: schema.querySpecs.sourceId,
          })
          .from(schema.querySpecs)
          .where(
            and(
              eq(schema.querySpecs.organizationId, orgId),
              inArray(schema.querySpecs.id, querySpecIds)
            )
          )
      : [];
    const sourceIdByQuerySpecId = new Map(querySpecs.map((spec) => [spec.id, spec.sourceId]));

    const dashboardIds = artifacts
      .filter((artifact) => artifact.type === 'dashboard')
      .map((artifact) => artifact.id);
    const dashboardItems = dashboardIds.length
      ? await db
          .select({
            dashboardArtifactId: schema.dashboardItems.dashboardArtifactId,
            childArtifactId: schema.dashboardItems.childArtifactId,
          })
          .from(schema.dashboardItems)
          .where(inArray(schema.dashboardItems.dashboardArtifactId, dashboardIds))
      : [];

    const dashboardIdsByChildArtifact = new Map<string, Set<string>>();
    for (const item of dashboardItems) {
      const existing = dashboardIdsByChildArtifact.get(item.childArtifactId) || new Set<string>();
      existing.add(item.dashboardArtifactId);
      dashboardIdsByChildArtifact.set(item.childArtifactId, existing);
    }

    const artifactNodes = artifacts.map((artifact) => {
      if (artifact.type === 'dashboard') {
        const widgetCount = dashboardItems.filter((item) => item.dashboardArtifactId === artifact.id).length;
        return {
          id: artifact.id,
          type: 'dashboard' as const,
          name: artifact.name,
          description: artifact.description || `${widgetCount} widgets`,
          parentIds: [] as string[],
          status: 'active' as const,
          metadata: { artifactType: artifact.type, widgetCount },
        };
      }

      const latestVersion = latestVersionByArtifactId.get(artifact.id);
      const sourceId = latestVersion?.querySpecId ? sourceIdByQuerySpecId.get(latestVersion.querySpecId) : undefined;
      return {
        id: artifact.id,
        type: 'view' as const,
        name: artifact.name,
        description: artifact.description || `${artifactTypeLabel(artifact.type)} artifact`,
        parentIds: sourceId ? [sourceId] : [],
        status: 'active' as const,
        metadata: { artifactType: artifact.type, displayType: artifactTypeLabel(artifact.type) },
      };
    });

    const dashboardNodeById = new Map(
      artifactNodes.filter((node) => node.type === 'dashboard').map((node) => [node.id, node])
    );

    for (const item of dashboardItems) {
      const dashboardNode = dashboardNodeById.get(item.dashboardArtifactId);
      if (!dashboardNode) continue;
      if (!dashboardNode.parentIds.includes(item.childArtifactId)) {
        dashboardNode.parentIds.push(item.childArtifactId);
      }
    }

    const outputs = await db
      .select({
        id: schema.outputs.id,
        name: schema.outputs.name,
        type: schema.outputs.type,
        dashboardId: schema.outputs.dashboardId,
        schedule: schema.outputs.schedule,
        status: schema.outputs.status,
      })
      .from(schema.outputs)
      .where(eq(schema.outputs.workstreamId, workstreamId));

    const nodes = [
      ...dataSources.map((ds) => ({
        id: ds.id,
        type: 'datasource' as const,
        name: ds.name,
        description: `${ds.type} - ${((ds.schemaCache as DataSourceSchemaCache | null)?.tables?.length || 0)} tables`,
        parentIds: [],
        status: ds.lastSyncedAt ? 'active' : 'syncing',
        metadata: { type: ds.type, schemaCache: ds.schemaCache },
      })),
      ...artifactNodes,
      ...outputs.map((output) => ({
        id: output.id,
        type: 'output' as const,
        name: output.name,
        description: `${output.type} - ${output.schedule || 'Manual'}`,
        parentIds: [output.dashboardId],
        status: output.status || 'active',
        metadata: { type: output.type, schedule: output.schedule },
      })),
      ...(projectAgent
        ? [
            {
              id: `project-agent:${projectAgent.projectId}`,
              type: 'output' as const,
              name: projectAgent.agentName || `${workstream.name} Agent`,
              description: `Project agent (${projectAgent.defaultModel})`,
              parentIds: [],
              status: 'active' as const,
              metadata: { type: 'project_agent', updatedAt: projectAgent.updatedAt },
            },
          ]
        : []),
    ];

    return NextResponse.json({
      workstream,
      nodes,
    });
  } catch (error) {
    console.error('Error fetching workstream:', error);
    return NextResponse.json({ error: 'Failed to fetch workstream' }, { status: 500 });
  }
}

// PATCH /api/workstreams/[id] - Update workstream
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDataSourceAssignmentTable();
    await ensureProjectAgentTables();
    const { id: workstreamId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const orgId = user.organizationId || 'default-org';

    const body = await request.json();
    const { name, description, color } = body;

    await db
      .update(schema.workstreams)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.workstreams.id, workstreamId),
          eq(schema.workstreams.organizationId, orgId)
        )
      );

    const [workstream] = await db
      .select()
      .from(schema.workstreams)
      .where(eq(schema.workstreams.id, workstreamId));

    return NextResponse.json({ workstream });
  } catch (error) {
    console.error('Error updating workstream:', error);
    return NextResponse.json({ error: 'Failed to update workstream' }, { status: 500 });
  }
}

// DELETE /api/workstreams/[id] - Delete workstream
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workstreamId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const orgId = user.organizationId || 'default-org';

    await db.transaction(async (tx) => {
      const [workstream] = await tx
        .select({ id: schema.workstreams.id })
        .from(schema.workstreams)
        .where(
          and(
            eq(schema.workstreams.id, workstreamId),
            eq(schema.workstreams.organizationId, orgId)
          )
        )
        .limit(1);

      if (!workstream) {
        throw new Error('WORKSTREAM_NOT_FOUND');
      }

      // Deleting a project should not automatically delete child entities.
      // Unassign them so they remain accessible elsewhere in the app.
      await tx
        .update(schema.dataSources)
        .set({ workstreamId: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.dataSources.organizationId, orgId),
            eq(schema.dataSources.workstreamId, workstreamId)
          )
        );
      await tx
        .delete(schema.dataSourceWorkstreams)
        .where(
          and(
            eq(schema.dataSourceWorkstreams.organizationId, orgId),
            eq(schema.dataSourceWorkstreams.workstreamId, workstreamId)
          )
        );

      await tx
        .update(schema.views)
        .set({ workstreamId: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.views.organizationId, orgId),
            eq(schema.views.workstreamId, workstreamId)
          )
        );

      await tx
        .update(schema.dashboards)
        .set({ workstreamId: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.dashboards.organizationId, orgId),
            eq(schema.dashboards.workstreamId, workstreamId)
          )
        );

      await tx
        .update(schema.outputs)
        .set({ workstreamId: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.outputs.organizationId, orgId),
            eq(schema.outputs.workstreamId, workstreamId)
          )
        );

      await tx
        .delete(schema.workstreams)
        .where(
          and(
            eq(schema.workstreams.id, workstreamId),
            eq(schema.workstreams.organizationId, orgId)
          )
        );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKSTREAM_NOT_FOUND') {
      return NextResponse.json({ error: 'Workstream not found' }, { status: 404 });
    }
    console.error('Error deleting workstream:', error);
    return NextResponse.json({ error: 'Failed to delete workstream' }, { status: 500 });
  }
}

