import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

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

// Helper to get current user from session
async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('agentic_session');

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    const session = JSON.parse(decoded);
    if (!session.userId) return null;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);

    return user;
  } catch {
    return null;
  }
}

// GET /api/workstreams/[id] - Get workstream with all nodes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workstreamId } = await params;
    const user = await getCurrentUser();
    const orgId = user?.organizationId || request.headers.get('x-org-id') || 'default-org';

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

    const dataSources = await db
      .select({
        id: schema.dataSources.id,
        name: schema.dataSources.name,
        type: schema.dataSources.type,
        schemaCache: schema.dataSources.schemaCache,
        lastSyncedAt: schema.dataSources.lastSyncedAt,
      })
      .from(schema.dataSources)
      .where(eq(schema.dataSources.workstreamId, workstreamId));

    const views = await db
      .select({
        id: schema.views.id,
        name: schema.views.name,
        description: schema.views.description,
        dataSourceId: schema.views.dataSourceId,
        sourceTable: schema.views.sourceTable,
        columns: schema.views.columns,
      })
      .from(schema.views)
      .where(eq(schema.views.workstreamId, workstreamId));

    const dashboards = await db
      .select({
        id: schema.dashboards.id,
        name: schema.dashboards.name,
        description: schema.dashboards.description,
      })
      .from(schema.dashboards)
      .where(eq(schema.dashboards.workstreamId, workstreamId));

    const dashboardsWithViews = await Promise.all(
      dashboards.map(async (dash) => {
        const widgets = await db
          .select({
            viewId: schema.widgets.viewId,
          })
          .from(schema.widgets)
          .where(eq(schema.widgets.dashboardId, dash.id));

        return {
          ...dash,
          viewIds: [...new Set(widgets.map((widget) => widget.viewId))],
          widgetCount: widgets.length,
        };
      })
    );

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

    const dataSourceSchemaById = new Map(
      dataSources.map((ds) => [
        ds.id,
        (ds.schemaCache as DataSourceSchemaCache | null) || null,
      ])
    );

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
      ...views.map((view) => {
        const viewColumns = (view.columns as Array<{ name: string; type: string }> | null) || [];
        const sourceTableColumns =
          dataSourceSchemaById
            .get(view.dataSourceId)
            ?.tables?.find((table) => table.name === view.sourceTable)
            ?.columns || [];
        const effectiveColumnCount = viewColumns.length || sourceTableColumns.length;

        return {
          id: view.id,
          type: 'view' as const,
          name: view.name,
          description: view.description || `${effectiveColumnCount} columns`,
          parentIds: [view.dataSourceId],
          status: 'active',
          metadata: { columns: viewColumns, sourceTable: view.sourceTable },
        };
      }),
      ...dashboardsWithViews.map((dashboard) => ({
        id: dashboard.id,
        type: 'dashboard' as const,
        name: dashboard.name,
        description: dashboard.description || `${dashboard.widgetCount} widgets`,
        parentIds: dashboard.viewIds,
        status: 'active',
        metadata: { widgetCount: dashboard.widgetCount },
      })),
      ...outputs.map((output) => ({
        id: output.id,
        type: 'output' as const,
        name: output.name,
        description: `${output.type} - ${output.schedule || 'Manual'}`,
        parentIds: [output.dashboardId],
        status: output.status || 'active',
        metadata: { type: output.type, schedule: output.schedule },
      })),
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
    const { id: workstreamId } = await params;
    const user = await getCurrentUser();
    const orgId = user?.organizationId || request.headers.get('x-org-id') || 'default-org';

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
    const orgId = user?.organizationId || request.headers.get('x-org-id') || 'default-org';

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

