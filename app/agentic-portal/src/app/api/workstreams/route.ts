import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { getDataSourceIdsForWorkstream } from '@/server/datasource-assignments';

// Helper to get current user from session
async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('agentic_session');
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    const session = JSON.parse(decoded);
    if (!session.userId) return null;
    
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);
    
    return user;
  } catch {
    return null;
  }
}

// GET /api/workstreams - List workstreams with stats
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || request.headers.get('x-org-id') || 'default-org';

    // Get workstreams
    const workstreams = await db
      .select()
      .from(schema.workstreams)
      .where(eq(schema.workstreams.organizationId, orgId))
      .orderBy(desc(schema.workstreams.updatedAt));

    // Get stats for each workstream
    const workstreamsWithStats = await Promise.all(
      workstreams.map(async (ws) => {
        const dataSourceIds = await getDataSourceIdsForWorkstream(orgId, ws.id);

        // Count views
        const [viewCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.views)
          .where(eq(schema.views.workstreamId, ws.id));

        // Count dashboards
        const [dashCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.dashboards)
          .where(eq(schema.dashboards.workstreamId, ws.id));

        // Count outputs
        const [outCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.outputs)
          .where(eq(schema.outputs.workstreamId, ws.id));

        return {
          ...ws,
          stats: {
            dataSources: dataSourceIds.length,
            views: Number(viewCount?.count || 0),
            dashboards: Number(dashCount?.count || 0),
            outputs: Number(outCount?.count || 0),
          }
        };
      })
    );

    return NextResponse.json({ workstreams: workstreamsWithStats });
  } catch (error) {
    console.error('Error fetching workstreams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workstreams' },
      { status: 500 }
    );
  }
}

// POST /api/workstreams - Create a new workstream
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || request.headers.get('x-org-id') || 'default-org';
    const userId = user?.id || 'system';

    const body = await request.json();
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(schema.workstreams).values({
      id,
      organizationId: orgId,
      name,
      description: description || null,
      color: color || '#8b5cf6',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    const [workstream] = await db
      .select()
      .from(schema.workstreams)
      .where(eq(schema.workstreams.id, id));

    return NextResponse.json({ 
      workstream: {
        ...workstream,
        stats: { dataSources: 0, views: 0, dashboards: 0, outputs: 0 }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating workstream:', error);
    return NextResponse.json(
      { error: 'Failed to create workstream' },
      { status: 500 }
    );
  }
}
