/**
 * Organization Stats API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, canAccessOrgAdmin, canManageOrganization } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { sql, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  
  if (!canAccessOrgAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user?.organizationId;
  
  if (!organizationId || !canManageOrganization(user, organizationId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    // Count users in org
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(eq(schema.users.organizationId, organizationId));
    
    // Count data sources in org
    const [dsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.dataSources)
      .where(eq(schema.dataSources.organizationId, organizationId));
    
    // Count chat sessions in org
    const [chatCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.organizationId, organizationId));
    
    return NextResponse.json({
      userCount: userCount?.count || 0,
      dataSourceCount: dsCount?.count || 0,
      chatSessionCount: chatCount?.count || 0,
      queryCount: 0, // TODO: Add query tracking
    });
  } catch (error) {
    console.error('[org/stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
