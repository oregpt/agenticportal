import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/auth';

async function requireOrgContext() {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return null;
  }

  return {
    userId: user.id,
    orgId: user.organizationId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrgContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workstreamId = searchParams.get('workstreamId');

    let outputList;
    if (workstreamId) {
      outputList = await db
        .select()
        .from(schema.outputs)
        .where(
          and(
            eq(schema.outputs.organizationId, context.orgId),
            eq(schema.outputs.workstreamId, workstreamId)
          )
        );
    } else {
      outputList = await db
        .select()
        .from(schema.outputs)
        .where(eq(schema.outputs.organizationId, context.orgId));
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
    const context = await requireOrgContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const [dashboard] = await db
      .select({ id: schema.dashboards.id })
      .from(schema.dashboards)
      .where(
        and(
          eq(schema.dashboards.id, dashboardId),
          eq(schema.dashboards.organizationId, context.orgId)
        )
      );

    if (!dashboard) {
      return NextResponse.json(
        { error: 'Dashboard not found' },
        { status: 404 }
      );
    }

    const id = uuidv4();

    const [output] = await db
      .insert(schema.outputs)
      .values({
        id,
        organizationId: context.orgId,
        name,
        type,
        config,
        workstreamId: workstreamId || null,
        dashboardId,
        schedule: config.schedule || 'manual',
        status: 'active',
        createdBy: context.userId,
      })
      .returning();

    return NextResponse.json({ output }, { status: 201 });
  } catch (error) {
    console.error('Error creating output:', error);
    return NextResponse.json(
      { error: 'Failed to create output' },
      { status: 500 }
    );
  }
}
