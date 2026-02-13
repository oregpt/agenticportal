/**
 * Register API - Create user and optionally organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createSessionToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const SESSION_COOKIE = 'agentic_session';

export async function POST(request: NextRequest) {
  try {
    const { email, name, password, organizationName } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }
    
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }
    
    const userId = uuidv4();
    let organizationId: string | null = null;
    
    // Create organization if name provided
    if (organizationName) {
      organizationId = uuidv4();
      const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64);
      
      await db.insert(schema.organizations).values({
        id: organizationId,
        name: organizationName,
        slug,
        settings: {},
      });
    }
    
    // Create user
    await db.insert(schema.users).values({
      id: userId,
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      organizationId,
      role: organizationId ? 'org_admin' : 'member', // First user of new org is admin
      isPlatformAdmin: 0,
    });
    
    // Create session
    const sessionToken = createSessionToken(userId, organizationId);
    
    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    
    return NextResponse.json({
      user: {
        id: userId,
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        role: organizationId ? 'org_admin' : 'member',
        isPlatformAdmin: false,
        organizationId,
      }
    });
  } catch (error) {
    console.error('[auth/register] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
