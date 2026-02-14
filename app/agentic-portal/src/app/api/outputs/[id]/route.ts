import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [output] = await db
      .select()
      .from(schema.outputs)
      .where(eq(schema.outputs.id, id));

    if (!output) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 });
    }

    return NextResponse.json({ output });
  } catch (error) {
    console.error('Error fetching output:', error);
    return NextResponse.json({ error: 'Failed to fetch output' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db
      .delete(schema.outputs)
      .where(eq(schema.outputs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting output:', error);
    return NextResponse.json({ error: 'Failed to delete output' }, { status: 500 });
  }
}
