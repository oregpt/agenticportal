/**
 * Login API - Simple email/password auth for demo
 * In production, integrate with Clerk, Auth0, or Supabase Auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createSessionToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getDatabaseConfigError } from '@/lib/database';

const SESSION_COOKIE = 'agentic_session';

function resolveAuthErrorResponse(error: unknown) {
  const dbConfigError = getDatabaseConfigError();
  if (dbConfigError) {
    return NextResponse.json({ error: 'Authentication temporarily unavailable: database configuration is missing.' }, { status: 503 });
  }

  const dbError = error as { code?: string; message?: string };
  if (dbError.code === '42P01') {
    return NextResponse.json({ error: 'Authentication temporarily unavailable: database tables are not initialized.' }, { status: 503 });
  }
  if (dbError.code === '42703' || dbError.code === '3D000') {
    return NextResponse.json({ error: 'Authentication temporarily unavailable: database schema is incompatible.' }, { status: 503 });
  }
  if (dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND' || dbError.code === 'ETIMEDOUT') {
    return NextResponse.json({ error: 'Authentication temporarily unavailable: cannot reach database.' }, { status: 503 });
  }

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }
    
    // Find user by email
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // For demo: accept any password for existing users
    // In production, verify against stored hash
    // const passwordHash = hashPassword(password);
    // if (user.passwordHash !== passwordHash) { ... }
    
    // Create session
    const sessionToken = createSessionToken(user.id, user.organizationId);
    
    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin === 1,
        organizationId: user.organizationId,
      }
    });
  } catch (error) {
    console.error('[auth/login] Error:', error);
    return resolveAuthErrorResponse(error);
  }
}
