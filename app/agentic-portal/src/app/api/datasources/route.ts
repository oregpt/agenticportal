import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createDataSourceAdapter } from '@/lib/datasources';
import { randomUUID } from 'crypto';
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
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);
    
    return user;
  } catch {
    return null;
  }
}

// GET /api/datasources - List all data sources for org
export async function GET(request: NextRequest) {
  try {
    // Get org from session or header
    const user = await getCurrentUser();
    const orgId = user?.organizationId || request.headers.get('x-org-id') || 'default-org';

    const dataSources = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.organizationId, orgId));

    // Don't send credentials to client
    const sanitized = dataSources.map((ds) => ({
      id: ds.id,
      organizationId: ds.organizationId, // Include for query API
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
    const { name, type, config, workstreamId } = body;

    // Get org and user from session
    const user = await getCurrentUser();
    const orgId = user?.organizationId || request.headers.get('x-org-id') || 'default-org';
    const userId = user?.id || request.headers.get('x-user-id') || 'default-user';
    console.log('[datasources POST] orgId:', orgId, 'userId:', userId);

    if (!name || !type || !config) {
      console.log('[datasources POST] Missing fields - name:', !!name, 'type:', !!type, 'config:', !!config);
      return NextResponse.json(
        { error: 'Missing required fields: name, type, config' },
        { status: 400 }
      );
    }

    // Special handling for Google Sheets Live (BigQuery external tables)
    if (type === 'google_sheets_live') {
      return handleGoogleSheetsLive(name, config, orgId, userId);
    }

    // Validate connection before saving (for standard adapters)
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
    
    // Extract selectedTables if provided
    const { selectedTables, ...restConfig } = config;

    const [inserted] = await db
      .insert(schema.dataSources)
      .values({
        id,
        organizationId: orgId,
        workstreamId: workstreamId || null,
        name,
        type,
        config: {
          ...restConfig,
          selectedTables: selectedTables || null,
        },
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

// Handle Google Sheets Live (BigQuery External Tables)
async function handleGoogleSheetsLive(
  name: string,
  config: { spreadsheetId: string; sheetName: string; hasHeader?: boolean; externalTableFQN?: string },
  orgId: string,
  userId: string
) {
  const { BigQuery } = await import('@google-cloud/bigquery');
  
  const keyJson = process.env.EDS_GCP_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    return NextResponse.json(
      { error: 'Platform GCP credentials not configured. Contact admin.' },
      { status: 500 }
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    // Railway sometimes strips quotes from JSON keys, try to fix it
    try {
      const fixed = keyJson.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      credentials = JSON.parse(fixed);
    } catch {
      return NextResponse.json(
        { error: 'Invalid platform GCP credentials.' },
        { status: 500 }
      );
    }
  }

  const { spreadsheetId, sheetName, hasHeader = true } = config;
  
  if (!spreadsheetId || !sheetName) {
    return NextResponse.json(
      { error: 'spreadsheetId and sheetName are required' },
      { status: 400 }
    );
  }

  const projectId = credentials.project_id;
  const datasetName = `agentic_portal_default`;
  const safeSheet = sheetName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 30);
  const tableName = `sheets_${spreadsheetId.substring(0, 8)}_${safeSheet}`;
  const sheetUri = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  try {
    const bigquery = new BigQuery({ projectId, credentials });
    const dataset = bigquery.dataset(datasetName);
    
    // Ensure dataset exists
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      await bigquery.createDataset(datasetName);
    }

    // Check if table exists
    const table = dataset.table(tableName);
    const [tableExists] = await table.exists();

    if (!tableExists) {
      // Create external table
      const escapedSheetName = sheetName.includes(' ') || /[^a-zA-Z0-9_]/.test(sheetName)
        ? `'${sheetName.replace(/'/g, "''")}'`
        : sheetName;

      // Use type assertion for external table config
      const tableOptions: any = {
        externalDataConfiguration: {
          sourceFormat: 'GOOGLE_SHEETS',
          sourceUris: [sheetUri],
          googleSheetsOptions: {
            skipLeadingRows: hasHeader ? 1 : 0,
            range: escapedSheetName,
          },
          autodetect: true,
        },
      };
      await dataset.createTable(tableName, tableOptions);
    }

    // Get schema from BigQuery
    const [metadata] = await table.getMetadata();
    const schemaFields = metadata.schema?.fields || [];
    const schemaCache = {
      tables: [{
        name: sheetName,
        columns: schemaFields.map((f: any) => ({
          name: f.name,
          type: f.type?.toLowerCase() || 'string',
          nullable: f.mode !== 'REQUIRED',
        })),
      }],
    };

    // Save to database
    const id = randomUUID();
    const now = new Date();
    const externalTableFQN = `${projectId}.${datasetName}.${tableName}`;

    const [inserted] = await db
      .insert(schema.dataSources)
      .values({
        id,
        organizationId: orgId,
        name,
        type: 'google_sheets_live',
        config: {
          spreadsheetId,
          sheetName,
          hasHeader,
          externalTableFQN,
          bqProjectId: projectId,
          bqDataset: datasetName,
          bqTableName: tableName,
        },
        schemaCache,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now,
      })
      .returning();

    return NextResponse.json({
      dataSource: {
        id: inserted.id,
        name: inserted.name,
        type: inserted.type,
        createdAt: inserted.createdAt,
        externalTableFQN,
      },
    });
  } catch (error: any) {
    console.error('[google-sheets-live] Error:', error);
    
    let userMessage = error.message || 'Failed to create Google Sheets Live data source';
    if (error.message?.includes('ACCESS_DENIED') || error.message?.includes('403')) {
      userMessage = `Access denied. Make sure the spreadsheet is shared with the service account.`;
    }
    
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
