/**
 * Views API
 *
 * GET  /api/views - List all views for the organization
 * POST /api/views - Create a new view
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

// Helper to get current user from session
async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('agentic_session');
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    // Session token is base64 encoded JSON
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

// GET /api/views - List views
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const viewsList = await db
      .select({
        id: schema.views.id,
        name: schema.views.name,
        description: schema.views.description,
        dataSourceId: schema.views.dataSourceId,
        sql: schema.views.sql,
        columns: schema.views.columns,
        createdAt: schema.views.createdAt,
        updatedAt: schema.views.updatedAt,
      })
      .from(schema.views)
      .where(eq(schema.views.organizationId, user.organizationId))
      .orderBy(desc(schema.views.createdAt));

    return NextResponse.json({ views: viewsList });
  } catch (error) {
    console.error('Error fetching views:', error);
    return NextResponse.json(
      { error: 'Failed to fetch views' },
      { status: 500 }
    );
  }
}

// POST /api/views - Create a new view
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, dataSourceId, sql, naturalLanguageQuery, workstreamId, sourceTable } = body;

    if (!name || !sql || !dataSourceId) {
      return NextResponse.json(
        { error: 'name, sql, and dataSourceId are required' },
        { status: 400 }
      );
    }

    // Verify data source belongs to organization
    const [dataSource] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.id, dataSourceId))
      .limit(1);

    if (!dataSource || dataSource.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    const viewId = randomUUID();
    const now = new Date();

    // Insert the view
    await db.insert(schema.views).values({
      id: viewId,
      organizationId: user.organizationId,
      workstreamId: workstreamId || null,
      dataSourceId,
      sourceTable: sourceTable || null, // The table this view queries from
      name,
      description: description || null,
      sql,
      naturalLanguageQuery: naturalLanguageQuery || null,
      columns: [], // Will be populated on first query
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id: viewId,
      name,
      description,
      dataSourceId,
      sql,
      createdAt: now,
    });
  } catch (error) {
    console.error('Error creating view:', error);
    return NextResponse.json(
      { error: 'Failed to create view' },
      { status: 500 }
    );
  }
}
