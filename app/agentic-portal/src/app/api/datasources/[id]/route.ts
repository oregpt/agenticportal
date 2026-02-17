import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [dataSource] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.id, id));

    if (!dataSource) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    const relatedViews = await db
      .select({ id: schema.views.id })
      .from(schema.views)
      .where(eq(schema.views.dataSourceId, id));

    return NextResponse.json({ dataSource, dependentViewCount: relatedViews.length });
  } catch (error) {
    console.error('Error fetching data source:', error);
    return NextResponse.json({ error: 'Failed to fetch data source' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const relatedViews = await db
      .select({ id: schema.views.id })
      .from(schema.views)
      .where(eq(schema.views.dataSourceId, id));

    const relatedViewIds = relatedViews.map((view) => view.id);

    if (relatedViewIds.length > 0) {
      await db
        .delete(schema.widgets)
        .where(inArray(schema.widgets.viewId, relatedViewIds));

      await db
        .delete(schema.views)
        .where(inArray(schema.views.id, relatedViewIds));
    }

    await db
      .delete(schema.dataSources)
      .where(eq(schema.dataSources.id, id));

    return NextResponse.json({ success: true, deletedViews: relatedViewIds.length });
  } catch (error) {
    console.error('Error deleting data source:', error);
    return NextResponse.json({ error: 'Failed to delete data source' }, { status: 500 });
  }
}
