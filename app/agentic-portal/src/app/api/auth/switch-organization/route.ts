import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSessionToken, getAccessibleOrganizations, getCurrentUser } from '@/lib/auth';

const SESSION_COOKIE = 'agentic_session';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = body?.organizationId as string | undefined;
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  const organizations = await getAccessibleOrganizations(user);
  const canAccessTarget = organizations.some((org) => org.id === organizationId);
  if (!canAccessTarget) {
    return NextResponse.json({ error: 'Organization is not accessible by this user' }, { status: 403 });
  }

  const sessionToken = createSessionToken(user.id, organizationId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return NextResponse.json({ ok: true, organizationId });
}

