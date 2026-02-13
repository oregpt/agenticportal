/**
 * Data Source Sync API
 *
 * POST /api/datasources/[id]/sync - Sync schema (refresh tables, columns) for a data source
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dataSources } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDataSourceAdapter, type DataSourceConfig } from '@/lib/datasources';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/datasources/[id]/sync
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    // For now, allow without organizationId for simpler testing
    // In production, this should be required and validated

    // Get the data source
    const whereClause = organizationId
      ? and(eq(dataSources.id, id), eq(dataSources.organizationId, organizationId))
      : eq(dataSources.id, id);

    const [source] = await db
      .select()
      .from(dataSources)
      .where(whereClause)
      .limit(1);

    if (!source) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
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
      
      // Test connection first
      const testResult = await adapter.testConnection();
      if (!testResult.success) {
        return NextResponse.json(
          { 
            error: 'Connection failed', 
            details: testResult.error 
          },
          { status: 400 }
        );
      }

      // Get schema
      const schema = await adapter.getSchema();

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
        success: true,
        schema,
        tableCount: schema.tables?.length || 0,
        lastSyncedAt: now,
      });
    } finally {
      if (adapter) {
        await adapter.disconnect();
      }
    }
  } catch (error) {
    console.error('Error syncing schema:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
