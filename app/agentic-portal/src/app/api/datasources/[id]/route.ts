/**
 * Single Data Source API
 *
 * GET    /api/datasources/[id] - Get single data source
 * PUT    /api/datasources/[id] - Update data source
 * DELETE /api/datasources/[id] - Delete data source
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { dataSources, users } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDataSourceAdapter, type DataSourceConfig } from '@/lib/datasources';
import { z } from 'zod';
import { cookies } from 'next/headers';

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
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    
    return user;
  } catch {
    return null;
  }
}

// Validation schemas
const updateDataSourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  testConnection: z.boolean().optional().default(false),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/datasources/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    let organizationId = searchParams.get('organizationId');

    // If no organizationId provided, try to get from session
    if (!organizationId) {
      const user = await getCurrentUser();
      if (user?.organizationId) {
        organizationId = user.organizationId;
      } else {
        return NextResponse.json(
          { error: 'Unauthorized or organizationId is required' },
          { status: 401 }
        );
      }
    }

    const [source] = await db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.id, id),
          eq(dataSources.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!source) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    // Don't expose sensitive config details
    const safeSource = {
      id: source.id,
      organizationId: source.organizationId, // Include for query API calls
      name: source.name,
      type: source.type,
      schemaCache: source.schemaCache,
      lastSyncedAt: source.lastSyncedAt,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      createdBy: source.createdBy,
    };

    return NextResponse.json({ dataSource: safeSource });
  } catch (error) {
    console.error('Error fetching data source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data source' },
      { status: 500 }
    );
  }
}

// PUT /api/datasources/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Validate input
    const parsed = updateDataSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get existing data source
    const [existing] = await db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.id, id),
          eq(dataSources.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    const { name, config, testConnection } = parsed.data;
    const now = new Date();

    // Merge configs if updating
    const newConfig = config
      ? { ...(existing.config as object), ...config }
      : existing.config;

    // Test connection if requested
    if (testConnection && config) {
      try {
        const fullConfig = {
          id,
          organizationId,
          name: name || existing.name,
          type: existing.type,
          createdAt: existing.createdAt,
          updatedAt: now,
          createdBy: existing.createdBy || 'system',
          ...(newConfig as Record<string, unknown>),
        } as DataSourceConfig;

        const adapter = await createDataSourceAdapter(fullConfig);
        const result = await adapter.testConnection();
        await adapter.disconnect();

        if (!result.success) {
          return NextResponse.json(
            { error: 'Connection test failed', details: result.error },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Connection test failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 400 }
        );
      }
    }

    // Update the data source
    const updateData: Record<string, unknown> = { updatedAt: now };
    if (name) updateData.name = name;
    if (config) updateData.config = newConfig;

    await db
      .update(dataSources)
      .set(updateData)
      .where(eq(dataSources.id, id));

    return NextResponse.json({
      dataSource: {
        id,
        name: name || existing.name,
        type: existing.type,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error('Error updating data source:', error);
    return NextResponse.json(
      { error: 'Failed to update data source' },
      { status: 500 }
    );
  }
}

// DELETE /api/datasources/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Check if exists
    const [existing] = await db
      .select({ id: dataSources.id, name: dataSources.name })
      .from(dataSources)
      .where(eq(dataSources.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    // Delete the data source
    await db.delete(dataSources).where(eq(dataSources.id, id));

    console.log(`[datasources DELETE] Deleted data source: ${existing.name} (${id})`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting data source:', error);
    return NextResponse.json(
      { error: 'Failed to delete data source' },
      { status: 500 }
    );
  }
}
