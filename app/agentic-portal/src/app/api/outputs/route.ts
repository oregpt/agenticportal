import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_ORG = 'default';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workstreamId = searchParams.get('workstreamId');

    let outputList;
    if (workstreamId) {
      outputList = await db
        .select()
        .from(schema.outputs)
        .where(eq(schema.outputs.workstreamId, workstreamId));
    } else {
      outputList = await db.select().from(schema.outputs);
    }

    return NextResponse.json({ outputs: outputList });
  } catch (error) {
    console.error('Error fetching outputs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outputs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, workstreamId, dashboardId, config = {} } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    if (!dashboardId) {
      return NextResponse.json(
        { error: 'Dashboard ID is required' },
        { status: 400 }
      );
    }

    const id = uuidv4();

    // Create output
    const [output] = await db
      .insert(schema.outputs)
      .values({
        id,
        organizationId: DEFAULT_ORG,
        name,
        type,
        config,
        workstreamId: workstreamId || null,
        dashboardId,
        schedule: config.schedule || 'manual',
        status: 'active',
      })
      .returning();

    return NextResponse.json({ output });
  } catch (error) {
    console.error('Error creating output:', error);
    return NextResponse.json(
      { error: 'Failed to create output' },
      { status: 500 }
    );
  }
}
