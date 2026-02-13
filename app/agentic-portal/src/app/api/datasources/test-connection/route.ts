/**
 * Test Connection API
 *
 * POST /api/datasources/test-connection
 * Tests a data source connection without saving it
 */

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, config } = body;

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    switch (type) {
      case 'bigquery':
        return testBigQueryConnection(config);
      case 'postgres':
        return testPostgresConnection(config);
      default:
        return NextResponse.json(
          { error: `Test connection not supported for type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[test-connection] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

async function testBigQueryConnection(config: {
  projectId: string;
  dataset: string;
  serviceAccountKey: string;
}) {
  const { projectId, dataset, serviceAccountKey } = config;

  if (!projectId || !dataset || !serviceAccountKey) {
    return NextResponse.json(
      { success: false, error: 'projectId, dataset, and serviceAccountKey are required' },
      { status: 400 }
    );
  }

  // Parse service account key
  let credentials;
  try {
    credentials = JSON.parse(serviceAccountKey);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid service account key JSON' },
      { status: 400 }
    );
  }

  try {
    const bigquery = new BigQuery({
      projectId,
      credentials,
    });

    // Test by listing tables in the dataset
    const [tables] = await bigquery.dataset(dataset).getTables();
    
    return NextResponse.json({
      success: true,
      message: `Connected successfully! Found ${tables.length} tables in dataset.`,
      tableCount: tables.length,
      tables: tables.slice(0, 10).map(t => t.id), // Return first 10 table names
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[test-connection] BigQuery error:', errorMessage);
    
    // Parse common BigQuery errors
    let userMessage = errorMessage;
    if (errorMessage.includes('Not found: Dataset')) {
      userMessage = `Dataset "${dataset}" not found in project "${projectId}". Check the dataset name.`;
    } else if (errorMessage.includes('Permission denied') || errorMessage.includes('403')) {
      userMessage = 'Permission denied. Check that the service account has BigQuery Data Viewer role.';
    } else if (errorMessage.includes('Invalid JWT')) {
      userMessage = 'Invalid service account key. Make sure you copied the entire JSON.';
    }
    
    return NextResponse.json({
      success: false,
      error: userMessage,
    });
  }
}

async function testPostgresConnection(config: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}) {
  const { host, port, database, username, password } = config;

  if (!host || !database || !username) {
    return NextResponse.json(
      { success: false, error: 'host, database, and username are required' },
      { status: 400 }
    );
  }

  try {
    // Dynamic import to avoid loading pg if not needed
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      host,
      port: port || 5432,
      database,
      user: username,
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    const client = await pool.connect();
    
    // Get table count
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const tableCount = parseInt(result.rows[0]?.count || '0');
    
    client.release();
    await pool.end();

    return NextResponse.json({
      success: true,
      message: `Connected successfully! Found ${tableCount} tables.`,
      tableCount,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[test-connection] Postgres error:', errorMessage);
    
    let userMessage = errorMessage;
    if (errorMessage.includes('ECONNREFUSED')) {
      userMessage = `Cannot connect to ${host}:${port}. Check the host and port.`;
    } else if (errorMessage.includes('password authentication failed')) {
      userMessage = 'Authentication failed. Check username and password.';
    } else if (errorMessage.includes('does not exist')) {
      userMessage = `Database "${database}" does not exist.`;
    }
    
    return NextResponse.json({
      success: false,
      error: userMessage,
    });
  }
}
