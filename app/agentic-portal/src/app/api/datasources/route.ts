import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, inArray } from 'drizzle-orm';
import { createDataSourceAdapter } from '@/lib/datasources';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import type { DataSourceConfig } from '@/lib/datasources';
import { loadPlatformGcpCredentials } from '@/lib/gcpCredentials';
import {
  ensureDataSourceAssignmentTable,
  getAssignedWorkstreamIdsForSources,
  getDataSourceIdsForWorkstream,
  replaceDataSourceAssignments,
} from '@/server/datasource-assignments';

const GOOGLE_SHEETS_BIGQUERY_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/drive.readonly',
];

function normalizeWorkstreamIds(input: {
  workstreamIds?: unknown;
  workstreamId?: unknown;
}): string[] {
  const combined = [
    ...(Array.isArray(input.workstreamIds) ? input.workstreamIds : []),
    ...(typeof input.workstreamId === 'string' ? [input.workstreamId] : []),
  ];

  return Array.from(
    new Set(
      combined.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  );
}

// GET /api/datasources - List all data sources for org
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = user.organizationId;

    const { searchParams } = new URL(request.url);
    const workstreamId = searchParams.get('workstreamId');
    await ensureDataSourceAssignmentTable();

    const dataSources = workstreamId
      ? await (async () => {
          const sourceIds = await getDataSourceIdsForWorkstream(orgId, workstreamId);
          if (sourceIds.length === 0) return [];
          return db
            .select()
            .from(schema.dataSources)
            .where(
              and(
                eq(schema.dataSources.organizationId, orgId),
                inArray(schema.dataSources.id, sourceIds)
              )
            );
        })()
      : await db
          .select()
          .from(schema.dataSources)
          .where(eq(schema.dataSources.organizationId, orgId));

    const assignmentMap = await getAssignedWorkstreamIdsForSources(
      orgId,
      dataSources.map((ds) => ds.id)
    );

    // Don't send credentials to client
    const sanitized = dataSources.map((ds) => ({
      id: ds.id,
      organizationId: ds.organizationId, // Include for query API
      workstreamId: ds.workstreamId,
      assignedWorkstreamIds: assignmentMap.get(ds.id) || [],
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
    const { name, type, config, workstreamId, workstreamIds } = body;

    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = user.organizationId;
    const userId = user.id;
    console.log('[datasources POST] orgId:', orgId, 'userId:', userId);

    if (!name || !type || !config) {
      console.log('[datasources POST] Missing fields - name:', !!name, 'type:', !!type, 'config:', !!config);
      return NextResponse.json(
        { error: 'Missing required fields: name, type, config' },
        { status: 400 }
      );
    }

    const requestedWorkstreamIds = normalizeWorkstreamIds({ workstreamId, workstreamIds });

    // Special handling for Google Sheets Live (BigQuery external tables)
    if (type === 'google_sheets_live') {
      return handleGoogleSheetsLive(name, config, orgId, userId, requestedWorkstreamIds);
    }

    // Extract selectedTables if provided
    const { selectedTables, ...restConfig } = config;

    // Validate connection and fetch schema before saving (for standard adapters)
    const testConfig = {
      id: 'test',
      organizationId: orgId,
      name,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      ...restConfig,
    };
    console.log('[datasources POST] testConfig type:', testConfig.type);

    let schemaCache: unknown = null;
    let lastSyncedAt: Date | null = null;

    try {
      console.log('[datasources POST] Creating adapter...');
      const adapter = await createDataSourceAdapter(testConfig as unknown as DataSourceConfig);
      try {
        console.log('[datasources POST] Testing connection...');
        const result = await adapter.testConnection();
        console.log('[datasources POST] Connection result:', result);

        if (!result.success) {
          return NextResponse.json(
            { error: `Connection test failed: ${result.error}` },
            { status: 400 }
          );
        }

        const fetchedSchema = await adapter.getSchema();
        if (
          selectedTables &&
          Array.isArray(selectedTables) &&
          selectedTables.length > 0 &&
          fetchedSchema &&
          typeof fetchedSchema === 'object' &&
          'tables' in fetchedSchema &&
          Array.isArray((fetchedSchema as { tables?: unknown[] }).tables)
        ) {
          const selectedSet = new Set(selectedTables as string[]);
          const typedSchema = fetchedSchema as unknown as {
            tables?: Array<{ name: string; columns?: unknown[] }>;
            [key: string]: unknown;
          };
          typedSchema.tables = (typedSchema.tables || []).filter((t) => selectedSet.has(t.name));
          schemaCache = typedSchema;
        } else {
          schemaCache = fetchedSchema;
        }
        lastSyncedAt = new Date();
      } finally {
        await adapter.disconnect();
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
        workstreamId: requestedWorkstreamIds[0] || null,
        name,
        type,
        config: {
          ...restConfig,
          selectedTables: selectedTables || null,
        },
        schemaCache,
        lastSyncedAt,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await replaceDataSourceAssignments({
      organizationId: orgId,
      dataSourceId: inserted.id,
      workstreamIds: requestedWorkstreamIds,
    });

    return NextResponse.json({
      dataSource: {
        id: inserted.id,
        name: inserted.name,
        type: inserted.type,
        assignedWorkstreamIds: requestedWorkstreamIds,
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
  userId: string,
  workstreamIds: string[]
) {
  const { BigQuery } = await import('@google-cloud/bigquery');

  const { credentials } = loadPlatformGcpCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: 'Platform GCP credentials not configured. Contact admin.' },
      { status: 500 }
    );
  }

  const { spreadsheetId, sheetName, hasHeader = true } = config;

  if (!spreadsheetId || !sheetName) {
    return NextResponse.json(
      { error: 'spreadsheetId and sheetName are required' },
      { status: 400 }
    );
  }

  const projectId = String(credentials.project_id || '');
  const datasetName = 'agentic_portal_default';
  const safeSheet = sheetName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 30);
  const tableName = `sheets_${spreadsheetId.substring(0, 8)}_${safeSheet}`;
  const sheetUri = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  try {
    const bigquery = new BigQuery({
      projectId,
      credentials,
      scopes: GOOGLE_SHEETS_BIGQUERY_SCOPES,
    });
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
      const tableOptions: {
        externalDataConfiguration: {
          sourceFormat: string;
          sourceUris: string[];
          googleSheetsOptions: { skipLeadingRows: number; range: string };
          autodetect: boolean;
        };
      } = {
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
      await dataset.createTable(
        tableName,
        tableOptions as unknown as Parameters<typeof dataset.createTable>[1]
      );
    }

    // Get schema from BigQuery
    const [metadata] = await table.getMetadata();
    const schemaFields = (metadata.schema?.fields || []) as Array<{
      name: string;
      type?: string;
      mode?: string;
    }>;
    const schemaCache = {
      tables: [{
        name: sheetName,
        columns: schemaFields.map((f) => ({
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
        workstreamId: workstreamIds[0] || null,
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

    await replaceDataSourceAssignments({
      organizationId: orgId,
      dataSourceId: inserted.id,
      workstreamIds,
    });

    return NextResponse.json({
      dataSource: {
        id: inserted.id,
        name: inserted.name,
        type: inserted.type,
        assignedWorkstreamIds: workstreamIds,
        createdAt: inserted.createdAt,
        externalTableFQN,
      },
    });
  } catch (error: unknown) {
    console.error('[google-sheets-live] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create Google Sheets Live data source';
    let userMessage = errorMessage;
    if (errorMessage.includes('ACCESS_DENIED') || errorMessage.includes('403')) {
      userMessage = 'Access denied. Make sure the spreadsheet is shared with the service account.';
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}