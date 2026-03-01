import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'agentic_session';

/**
 * Protected route prefixes — any path starting with these requires authentication.
 */
const PROTECTED_PREFIXES = [
  '/workstreams',
  '/dashboards',
  '/datasources',
  '/views',
  '/outputs',
  '/artifacts',
  '/artifact-runs',
  '/delivery',
  '/relationship-explorer',
  '/project-agent',
  '/dashboard',
  '/admin',
  '/org',
];

/** Paths that should never be intercepted. */
const PUBLIC_PREFIXES = [
  '/api/',
  '/login',
  '/register',
  '/_next/',
  '/favicon',
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isSessionValid(token: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (!decoded.userId) return false;
    if (new Date(decoded.expiresAt) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Only guard protected paths
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionToken || !isSessionValid(sessionToken)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
