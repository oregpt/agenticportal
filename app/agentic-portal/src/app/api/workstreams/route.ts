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

        // Count dashboards (artifact-native)
        const [dashboardCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.artifacts)
          .where(
            sql`${schema.artifacts.organizationId} = ${orgId}
                AND ${schema.artifacts.projectId} = ${ws.id}
                AND ${schema.artifacts.type} = 'dashboard'
                AND ${schema.artifacts.status} = 'active'`
          );

        // Count non-dashboard artifacts (table/chart/kpi/report)
        const [artifactCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.artifacts)
          .where(
            sql`${schema.artifacts.organizationId} = ${orgId}
                AND ${schema.artifacts.projectId} = ${ws.id}
                AND ${schema.artifacts.type} <> 'dashboard'
                AND ${schema.artifacts.status} = 'active'`
          );

        // Count project agents configured for this project
        const [projectAgentCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.projectAgents)
          .where(
            sql`${schema.projectAgents.organizationId} = ${orgId}
                AND ${schema.projectAgents.projectId} = ${ws.id}`
          );

        // Count data deliveries configured for this project
        const [deliveryCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.deliveryChannels)
          .where(
            sql`${schema.deliveryChannels.organizationId} = ${orgId}
                AND ${schema.deliveryChannels.projectId} = ${ws.id}`
          );

        return {
          ...ws,
          stats: {
            dataSources: dataSourceIds.length,
            dashboards: Number(dashboardCount?.count || 0),
            artifacts: Number(artifactCount?.count || 0),
            projectAgents: Number(projectAgentCount?.count || 0),
            deliveries: Number(deliveryCount?.count || 0),
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
        stats: { dataSources: 0, dashboards: 0, artifacts: 0, projectAgents: 0, deliveries: 0 }
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
