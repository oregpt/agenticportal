import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

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

    return NextResponse.json({ dataSource });
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
    
    await db
      .delete(schema.dataSources)
      .where(eq(schema.dataSources.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting data source:', error);
    return NextResponse.json({ error: 'Failed to delete data source' }, { status: 500 });
  }
}
