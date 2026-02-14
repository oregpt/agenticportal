import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_ORG = 'default';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workstreamId = searchParams.get('workstreamId');

    let dashboardList;
    if (workstreamId) {
      dashboardList = await db
        .select()
        .from(schema.dashboards)
        .where(eq(schema.dashboards.workstreamId, workstreamId));
    } else {
      dashboardList = await db.select().from(schema.dashboards);
    }

    return NextResponse.json({ dashboards: dashboardList });
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
    const body = await request.json();
    const { name, workstreamId, viewIds = [] } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const id = uuidv4();

    // Create dashboard
    const [dashboard] = await db
      .insert(schema.dashboards)
      .values({
        id,
        organizationId: DEFAULT_ORG,
        name,
        workstreamId: workstreamId || null,
      })
      .returning();

    // If viewIds provided, create widgets for each view
    if (viewIds.length > 0) {
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

    return NextResponse.json({ dashboard });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to create dashboard' },
      { status: 500 }
    );
  }
}
