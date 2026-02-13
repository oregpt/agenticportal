/**
 * Platform Admin Users API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, canAccessPlatformAdmin } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  const user = await getCurrentUser();
  
  if (!canAccessPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    // Get all users with organization names
    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        isPlatformAdmin: schema.users.isPlatformAdmin,
        organizationId: schema.users.organizationId,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.createdAt);
    
    // Get organization names
    const orgs = await db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
      })
      .from(schema.organizations);
    
    const orgMap = new Map(orgs.map(o => [o.id, o.name]));
    
    const usersWithOrgs = users.map(u => ({
      ...u,
      isPlatformAdmin: u.isPlatformAdmin === 1,
      organizationName: u.organizationId ? orgMap.get(u.organizationId) : null,
    }));
    
    return NextResponse.json({ users: usersWithOrgs });
  } catch (error) {
    console.error('[admin/users] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
