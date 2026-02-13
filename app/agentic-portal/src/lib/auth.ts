/**
 * Authentication utilities
 */

import { cookies } from 'next/headers';
import { db, schema } from './db';
import { eq } from 'drizzle-orm';

export type UserRole = 'platform_admin' | 'org_admin' | 'member' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  organizationId: string | null;
  organizationName?: string;
  role: UserRole;
  isPlatformAdmin: boolean;
}

export interface AuthSession {
  userId: string;
  organizationId: string | null;
  expiresAt: Date;
}

const SESSION_COOKIE = 'agentic_session';
const SESSION_EXPIRY_DAYS = 7;

/**
 * Get current session from cookies
 */
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  
  if (!sessionToken) return null;
  
  try {
    const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
    if (new Date(decoded.expiresAt) < new Date()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;
  
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  
  if (!user) return null;
  
  let organizationName: string | undefined;
  if (user.organizationId) {
    const [org] = await db
      .select({ name: schema.organizations.name })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, user.organizationId))
      .limit(1);
    organizationName = org?.name;
  }
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    organizationId: user.organizationId,
    organizationName,
    role: user.role as UserRole,
    isPlatformAdmin: user.isPlatformAdmin === 1,
  };
}

/**
 * Create session for user
 */
export function createSessionToken(userId: string, organizationId: string | null): string {
  const session: AuthSession = {
    userId,
    organizationId,
    expiresAt: new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  };
  return Buffer.from(JSON.stringify(session)).toString('base64');
}

/**
 * Check if user can access platform admin
 */
export function canAccessPlatformAdmin(user: AuthUser | null): boolean {
  return user?.isPlatformAdmin === true;
}

/**
 * Check if user can access org admin
 */
export function canAccessOrgAdmin(user: AuthUser | null): boolean {
  return user?.isPlatformAdmin === true || 
         user?.role === 'org_admin' || 
         user?.role === 'platform_admin';
}

/**
 * Check if user can manage an organization
 */
export function canManageOrganization(user: AuthUser | null, orgId: string): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  return user.organizationId === orgId && (user.role === 'org_admin' || user.role === 'platform_admin');
}
