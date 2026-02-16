import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { position, config, title, type } = body;

    const [widget] = await db
      .select({
        id: schema.widgets.id,
        dashboardId: schema.widgets.dashboardId,
      })
      .from(schema.widgets)
      .where(eq(schema.widgets.id, id))
      .limit(1);

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    const [dashboard] = await db
      .select()
      .from(schema.dashboards)
      .where(
        and(
          eq(schema.dashboards.id, widget.dashboardId),
          eq(schema.dashboards.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!dashboard) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const [updated] = await db
      .update(schema.widgets)
      .set({
        ...(position !== undefined ? { position } : {}),
        ...(config !== undefined ? { config } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(type !== undefined ? { type } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.widgets.id, id))
      .returning();

    return NextResponse.json({ widget: updated });
  } catch (error) {
    console.error('Error updating widget:', error);
    return NextResponse.json({ error: 'Failed to update widget' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const [widget] = await db
      .select({
        id: schema.widgets.id,
        dashboardId: schema.widgets.dashboardId,
      })
      .from(schema.widgets)
      .where(eq(schema.widgets.id, id))
      .limit(1);

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    const [dashboard] = await db
      .select()
      .from(schema.dashboards)
      .where(
        and(
          eq(schema.dashboards.id, widget.dashboardId),
          eq(schema.dashboards.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!dashboard) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await db.delete(schema.widgets).where(eq(schema.widgets.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting widget:', error);
    return NextResponse.json({ error: 'Failed to delete widget' }, { status: 500 });
  }
}
