/**
 * Logout API - Clear session
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'agentic_session';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  
  return NextResponse.json({ success: true });
}
