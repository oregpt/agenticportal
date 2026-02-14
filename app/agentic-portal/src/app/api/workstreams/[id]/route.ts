import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

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

    // Get workstream
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
      return NextResponse.json(
        { error: 'Workstream not found' },
        { status: 404 }
      );
    }

    // Get all nodes for this workstream
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

    // Get widgets for each dashboard to know which views they use
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
          viewIds: [...new Set(widgets.map(w => w.viewId))],
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
        lastRunAt: schema.outputs.lastRunAt,
      })
      .from(schema.outputs)
      .where(eq(schema.outputs.workstreamId, workstreamId));

    // Transform to node format
    const nodes = [
      ...dataSources.map(ds => ({
        id: ds.id,
        type: 'datasource' as const,
        name: ds.name,
        description: `${ds.type} • ${(ds.schemaCache as any)?.tables?.length || 0} tables`,
        parentIds: [],
        status: ds.lastSyncedAt ? 'active' : 'syncing',
        metadata: { type: ds.type, schemaCache: ds.schemaCache },
      })),
      ...views.map(v => ({
        id: v.id,
        type: 'view' as const,
        name: v.name,
        description: v.description || `${(v.columns as any[])?.length || 0} columns`,
        parentIds: [v.dataSourceId],
        status: 'active',
        metadata: { columns: v.columns },
      })),
      ...dashboardsWithViews.map(d => ({
        id: d.id,
        type: 'dashboard' as const,
        name: d.name,
        description: d.description || `${d.widgetCount} widgets`,
        parentIds: d.viewIds,
        status: 'active',
        metadata: { widgetCount: d.widgetCount },
      })),
      ...outputs.map(o => ({
        id: o.id,
        type: 'output' as const,
        name: o.name,
        description: `${o.type} • ${o.schedule || 'Manual'}`,
        parentIds: [o.dashboardId],
        status: o.status || 'active',
        metadata: { type: o.type, schedule: o.schedule },
      })),
    ];

    return NextResponse.json({
      workstream,
      nodes,
    });
  } catch (error) {
    console.error('Error fetching workstream:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workstream' },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: 'Failed to update workstream' },
      { status: 500 }
    );
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

    await db
      .delete(schema.workstreams)
      .where(
        and(
          eq(schema.workstreams.id, workstreamId),
          eq(schema.workstreams.organizationId, orgId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workstream:', error);
    return NextResponse.json(
      { error: 'Failed to delete workstream' },
      { status: 500 }
    );
  }
}
