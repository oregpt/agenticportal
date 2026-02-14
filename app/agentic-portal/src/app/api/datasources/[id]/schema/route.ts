/**
 * Data Source Schema API
 *
 * GET /api/datasources/[id]/schema - Get schema (tables, columns) for a data source
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dataSources } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDataSourceAdapter, type DataSourceConfig } from '@/lib/datasources';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/datasources/[id]/schema
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const refresh = searchParams.get('refresh') === 'true';

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Get the data source
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

    // Check if we have cached schema and don't need to refresh
    if (source.schemaCache && !refresh) {
      return NextResponse.json({
        schema: source.schemaCache,
        cached: true,
        lastSyncedAt: source.lastSyncedAt,
      });
    }

    // Build the full config
    const config = source.config as Record<string, unknown>;
    const fullConfig: DataSourceConfig = {
      id: source.id,
      organizationId: source.organizationId,
      name: source.name,
      type: source.type,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      createdBy: source.createdBy || 'system',
      ...config,
    } as DataSourceConfig;

    // Get schema from the adapter
    let adapter;
    try {
      adapter = await createDataSourceAdapter(fullConfig);
      let schema = await adapter.getSchema();

      // Filter to selectedTables if configured
      const selectedTables = config.selectedTables as string[] | undefined;
      if (selectedTables && selectedTables.length > 0 && schema.tables) {
        const selectedSet = new Set(selectedTables);
        schema = {
          ...schema,
          tables: schema.tables.filter((t: { name: string }) => selectedSet.has(t.name)),
        };
      }

      // Cache the schema
      const now = new Date();
      await db
        .update(dataSources)
        .set({
          schemaCache: schema,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(dataSources.id, id));

      return NextResponse.json({
        schema,
        cached: false,
        lastSyncedAt: now,
      });
    } finally {
      if (adapter) {
        await adapter.disconnect();
      }
    }
  } catch (error) {
    console.error('Error fetching schema:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
