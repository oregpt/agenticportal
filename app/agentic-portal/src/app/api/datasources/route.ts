import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createDataSourceAdapter } from '@/lib/datasources';
import { randomUUID } from 'crypto';

// GET /api/datasources - List all data sources for org
export async function GET(request: NextRequest) {
  try {
    // TODO: Get org from session
    const orgId = request.headers.get('x-org-id') || 'default-org';

    const dataSources = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.organizationId, orgId));

    // Don't send credentials to client
    const sanitized = dataSources.map((ds) => ({
      id: ds.id,
      name: ds.name,
      type: ds.type,
      createdAt: ds.createdAt,
      updatedAt: ds.updatedAt,
      lastSyncedAt: ds.lastSyncedAt,
      schemaCache: ds.schemaCache,
    }));

    return NextResponse.json({ dataSources: sanitized });
  } catch (error) {
    console.error('Error fetching data sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data sources' },
      { status: 500 }
    );
  }
}

// POST /api/datasources - Create a new data source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[datasources POST] Received body:', JSON.stringify(body, null, 2));
    const { name, type, config } = body;

    // TODO: Get org and user from session
    const orgId = request.headers.get('x-org-id') || 'default-org';
    const userId = request.headers.get('x-user-id') || 'default-user';
    console.log('[datasources POST] orgId:', orgId, 'userId:', userId);

    if (!name || !type || !config) {
      console.log('[datasources POST] Missing fields - name:', !!name, 'type:', !!type, 'config:', !!config);
      return NextResponse.json(
        { error: 'Missing required fields: name, type, config' },
        { status: 400 }
      );
    }

    // Validate connection before saving
    const testConfig = {
      id: 'test',
      organizationId: orgId,
      name,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      ...config,
    };
    console.log('[datasources POST] testConfig type:', testConfig.type);

    try {
      console.log('[datasources POST] Creating adapter...');
      const adapter = await createDataSourceAdapter(testConfig as any);
      console.log('[datasources POST] Testing connection...');
      const result = await adapter.testConnection();
      console.log('[datasources POST] Connection result:', result);
      await adapter.disconnect();

      if (!result.success) {
        return NextResponse.json(
          { error: `Connection test failed: ${result.error}` },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error('[datasources POST] Connection test error:', err);
      return NextResponse.json(
        { error: `Connection test failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    // TODO: Encrypt sensitive config fields
    const id = randomUUID();
    const now = new Date();

    const [inserted] = await db
      .insert(schema.dataSources)
      .values({
        id,
        organizationId: orgId,
        name,
        type,
        config,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({
      dataSource: {
        id: inserted.id,
        name: inserted.name,
        type: inserted.type,
        createdAt: inserted.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating data source:', error);
    return NextResponse.json(
      { error: 'Failed to create data source' },
      { status: 500 }
    );
  }
}
