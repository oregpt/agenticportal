import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { dashboardId, viewId, type, title, position, config } = body;

    if (!dashboardId || !viewId || !type || !position) {
      return NextResponse.json(
        { error: 'dashboardId, viewId, type, and position are required' },
        { status: 400 }
      );
    }

    const [dashboard] = await db
      .select()
      .from(schema.dashboards)
      .where(
        and(
          eq(schema.dashboards.id, dashboardId),
          eq(schema.dashboards.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const [view] = await db
      .select()
      .from(schema.views)
      .where(
        and(
          eq(schema.views.id, viewId),
          eq(schema.views.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!view) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    const widgetId = uuidv4();
    const [widget] = await db
      .insert(schema.widgets)
      .values({
        id: widgetId,
        dashboardId,
        viewId,
        type,
        title: title || null,
        position,
        config: config || {},
      })
      .returning();

    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    console.error('Error creating widget:', error);
    return NextResponse.json({ error: 'Failed to create widget' }, { status: 500 });
  }
}
