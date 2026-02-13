/**
 * Organization Member Invite API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, canAccessOrgAdmin, canManageOrganization } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  
  if (!canAccessOrgAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { email, role, organizationId } = await request.json();
    
    const targetOrgId = organizationId || user?.organizationId;
    
    if (!targetOrgId || !canManageOrganization(user, targetOrgId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    if (!email?.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    
    if (existingUser) {
      // If user exists but not in this org, add them
      if (existingUser.organizationId !== targetOrgId) {
        await db
          .update(schema.users)
          .set({ 
            organizationId: targetOrgId, 
            role: role || 'member',
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, existingUser.id));
        
        return NextResponse.json({ 
          message: 'User added to organization',
          userId: existingUser.id 
        });
      }
      
      return NextResponse.json(
        { error: 'User is already in this organization' },
        { status: 400 }
      );
    }
    
    // Create new user
    const userId = uuidv4();
    await db.insert(schema.users).values({
      id: userId,
      email: email.toLowerCase(),
      name: email.split('@')[0],
      organizationId: targetOrgId,
      role: role || 'member',
      isPlatformAdmin: 0,
    });
    
    // TODO: Send invitation email
    
    return NextResponse.json({ 
      message: 'Invitation sent',
      userId 
    });
  } catch (error) {
    console.error('[org/members/invite] Error:', error);
    return NextResponse.json(
      { error: 'Failed to invite member' },
      { status: 500 }
    );
  }
}
