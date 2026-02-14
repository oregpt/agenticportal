/**
 * View Detail API
 *
 * GET    /api/views/[id] - Get a specific view
 * DELETE /api/views/[id] - Delete a view
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper to get current user from session
async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('agentic_session');
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    // Session token is base64 encoded JSON
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    const session = JSON.parse(decoded);
    if (!session.userId) return null;
    
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);
    
    return user;
  } catch {
    return null;
  }
}

// GET /api/views/[id] - Get a specific view
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [view] = await db
      .select()
      .from(schema.views)
      .where(
        and(
          eq(schema.views.id, id),
          eq(schema.views.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!view) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    return NextResponse.json({ view });
  } catch (error) {
    console.error('Error fetching view:', error);
    return NextResponse.json(
      { error: 'Failed to fetch view' },
      { status: 500 }
    );
  }
}

// DELETE /api/views/[id] - Delete a view
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify view belongs to user's org
    const [view] = await db
      .select()
      .from(schema.views)
      .where(
        and(
          eq(schema.views.id, id),
          eq(schema.views.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!view) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    await db
      .delete(schema.views)
      .where(eq(schema.views.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting view:', error);
    return NextResponse.json(
      { error: 'Failed to delete view' },
      { status: 500 }
    );
  }
}
