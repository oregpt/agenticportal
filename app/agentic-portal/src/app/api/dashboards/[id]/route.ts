import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [dashboard] = await db
      .select()
      .from(schema.dashboards)
      .where(eq(schema.dashboards.id, id));

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    // Get widgets
    const widgets = await db
      .select()
      .from(schema.widgets)
      .where(eq(schema.widgets.dashboardId, id));

    return NextResponse.json({ dashboard, widgets });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Delete widgets first
    await db
      .delete(schema.widgets)
      .where(eq(schema.widgets.dashboardId, id));
    
    // Then delete dashboard
    await db
      .delete(schema.dashboards)
      .where(eq(schema.dashboards.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    return NextResponse.json({ error: 'Failed to delete dashboard' }, { status: 500 });
  }
}
