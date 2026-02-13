/**
 * Platform Admin Stats API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, canAccessPlatformAdmin } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const user = await getCurrentUser();
  
  if (!canAccessPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    // Count organizations
    const [orgCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.organizations);
    
    // Count users
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users);
    
    // Count data sources
    const [dsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.dataSources);
    
    // Count chat sessions
    const [chatCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.chatSessions);
    
    return NextResponse.json({
      totalOrganizations: orgCount?.count || 0,
      totalUsers: userCount?.count || 0,
      totalDataSources: dsCount?.count || 0,
      totalChatSessions: chatCount?.count || 0,
    });
  } catch (error) {
    console.error('[admin/stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
