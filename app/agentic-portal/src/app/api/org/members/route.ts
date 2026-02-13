/**
 * Organization Members API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, canAccessOrgAdmin, canManageOrganization } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

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
    const members = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.organizationId, organizationId))
      .orderBy(schema.users.createdAt);
    
    return NextResponse.json({ members });
  } catch (error) {
    console.error('[org/members] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
