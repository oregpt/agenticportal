import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, sql } from 'drizzle-orm';
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

    let dashboardList;
    if (workstreamId) {
      dashboardList = await db
        .select()
        .from(schema.dashboards)
        .where(
          and(
            eq(schema.dashboards.organizationId, context.orgId),
            eq(schema.dashboards.workstreamId, workstreamId)
          )
        );
    } else {
      dashboardList = await db
        .select()
        .from(schema.dashboards)
        .where(eq(schema.dashboards.organizationId, context.orgId));
    }

    const dashboardsWithCounts = await Promise.all(
      dashboardList.map(async (dashboard) => {
        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.widgets)
          .where(eq(schema.widgets.dashboardId, dashboard.id));

        return {
          ...dashboard,
          widgetCount: Number(countRow?.count || 0),
        };
      })
    );

    return NextResponse.json({ dashboards: dashboardsWithCounts });
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboards' },
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
    const { name, description, workstreamId, viewIds = [] } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const id = uuidv4();

    const [dashboard] = await db
      .insert(schema.dashboards)
      .values({
        id,
        organizationId: context.orgId,
        name,
        description: description || null,
        workstreamId: workstreamId || null,
        createdBy: context.userId,
      })
      .returning();

    if (Array.isArray(viewIds) && viewIds.length > 0) {
      const widgetValues = viewIds.map((viewId: string, index: number) => ({
        id: uuidv4(),
        dashboardId: id,
        viewId,
        type: 'table',
        title: `View ${index + 1}`,
        position: { x: 0, y: index * 6, width: 12, height: 6 },
        config: {},
      }));

      await db.insert(schema.widgets).values(widgetValues);
    }

    return NextResponse.json({ dashboard }, { status: 201 });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to create dashboard' },
      { status: 500 }
    );
  }
}
