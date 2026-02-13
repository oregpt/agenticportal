/**
 * Data Source Query API
 *
 * POST /api/datasources/[id]/query - Execute a query against the data source
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dataSources } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDataSourceAdapter, type DataSourceConfig } from '@/lib/datasources';
import { z } from 'zod';

// Validation schema
const querySchema = z.object({
  sql: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().min(1).max(10000).optional().default(1000),
  validate: z.boolean().optional().default(false),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/datasources/[id]/query
export async function POST(request: NextRequest, context: RouteContext) {
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
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sql, params, limit, validate } = parsed.data;

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

    // Execute or validate the query
    let adapter;
    try {
      adapter = await createDataSourceAdapter(fullConfig);

      // Validate only mode
      if (validate) {
        if (!adapter.validateQuery) {
          return NextResponse.json(
            { error: 'Query validation not supported for this data source type' },
            { status: 400 }
          );
        }
        const validation = await adapter.validateQuery(sql);
        return NextResponse.json({ validation });
      }

      // Add LIMIT if not present (basic safety)
      let finalSql = sql.trim();
      const hasLimit = /\blimit\s+\d+/i.test(finalSql);
      if (!hasLimit && !finalSql.toLowerCase().startsWith('insert') 
          && !finalSql.toLowerCase().startsWith('update')
          && !finalSql.toLowerCase().startsWith('delete')) {
        finalSql = `${finalSql} LIMIT ${limit}`;
      }

      // Block dangerous operations (basic safety)
      const lowerSql = finalSql.toLowerCase();
      if (lowerSql.includes('drop ') || lowerSql.includes('truncate ') 
          || lowerSql.includes('alter ') || lowerSql.includes('create ')
          || lowerSql.includes('delete ') || lowerSql.includes('update ')) {
        return NextResponse.json(
          { error: 'Mutating operations are not allowed. Only SELECT queries are permitted.' },
          { status: 400 }
        );
      }

      // Execute the query
      const result = await adapter.executeQuery(finalSql, params);

      return NextResponse.json({
        result: {
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
          executionTimeMs: result.executionTimeMs,
          truncated: result.rowCount >= limit,
        },
      });
    } finally {
      if (adapter) {
        await adapter.disconnect();
      }
    }
  } catch (error) {
    console.error('Error executing query:', error);
    return NextResponse.json(
      {
        error: 'Query execution failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
