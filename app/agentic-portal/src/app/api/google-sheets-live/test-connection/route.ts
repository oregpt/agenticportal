/**
 * Google Sheets Live - Test Connection
 * 
 * POST /api/google-sheets-live/test-connection
 * Tests creating a BigQuery external table pointing to a Google Sheet
 */

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

function getPlatformCredentials() {
  const keyJson = process.env.EDS_GCP_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    return null;
  }
  try {
    const credentials = JSON.parse(keyJson);
    return {
      credentials,
      projectId: credentials.project_id,
      serviceAccountEmail: credentials.client_email,
    };
  } catch {
    return null;
  }
}

// Generate a safe dataset name from org context
function generateDatasetName(context: string): string {
  return `agentic_portal_${context.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`;
}

// Generate a safe table name from sheet info
function generateTableName(spreadsheetId: string, sheetName: string): string {
  const safeSheet = sheetName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 30);
  return `sheets_${spreadsheetId.substring(0, 8)}_${safeSheet}`;
}

export async function POST(request: NextRequest) {
  try {
    const { spreadsheetId, sheetName, hasHeader = true } = await request.json();

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { success: false, error: 'spreadsheetId and sheetName are required' },
        { status: 400 }
      );
    }

    const platformCreds = getPlatformCredentials();
    if (!platformCreds) {
      return NextResponse.json(
        { success: false, error: 'Platform GCP credentials not configured. Contact admin.' },
        { status: 500 }
      );
    }

    const { credentials, projectId } = platformCreds;
    
    // Create BigQuery client with service account
    const bigquery = new BigQuery({
      projectId,
      credentials,
    });

    const datasetName = generateDatasetName('default');
    const tableName = generateTableName(spreadsheetId, sheetName);
    const sheetUri = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Ensure dataset exists
    const dataset = bigquery.dataset(datasetName);
    const [datasetExists] = await dataset.exists();
    
    if (!datasetExists) {
      console.log(`[sheets-live] Creating dataset: ${datasetName}`);
      await bigquery.createDataset(datasetName);
    }

    // Check if table already exists
    const table = dataset.table(tableName);
    const [tableExists] = await table.exists();

    if (tableExists) {
      // Table exists, verify we can query it
      try {
        const [rows] = await bigquery.query({
          query: `SELECT COUNT(*) as row_count FROM \`${projectId}.${datasetName}.${tableName}\``,
        });
        
        return NextResponse.json({
          success: true,
          message: `External table already exists and is accessible.`,
          externalTableFQN: `${projectId}.${datasetName}.${tableName}`,
          rowCount: rows[0]?.row_count || 0,
          alreadyExists: true,
        });
      } catch (queryError: any) {
        // Table exists but can't query - might need to recreate
        console.log(`[sheets-live] Existing table not queryable, will recreate`);
        await table.delete();
      }
    }

    // Create external table pointing to Google Sheets
    // Escape sheet names with spaces or special characters
    const escapedSheetName = sheetName.includes(' ') || /[^a-zA-Z0-9_]/.test(sheetName)
      ? `'${sheetName.replace(/'/g, "''")}'`
      : sheetName;

    const tableOptions = {
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

    console.log(`[sheets-live] Creating external table: ${tableName} for sheet: ${sheetName}`);
    await dataset.createTable(tableName, tableOptions);

    // Verify by querying
    const [testRows] = await bigquery.query({
      query: `SELECT COUNT(*) as row_count FROM \`${projectId}.${datasetName}.${tableName}\``,
    });

    return NextResponse.json({
      success: true,
      message: `External table created successfully! Your sheet is now SQL queryable.`,
      externalTableFQN: `${projectId}.${datasetName}.${tableName}`,
      rowCount: testRows[0]?.row_count || 0,
      alreadyExists: false,
    });

  } catch (error: any) {
    console.error('[sheets-live] Test connection error:', error);
    
    let userMessage = error.message || 'Failed to create external table';
    
    // Parse common errors
    if (error.message?.includes('ACCESS_DENIED') || error.message?.includes('403')) {
      userMessage = `Access denied. Make sure you shared the spreadsheet with the service account email.`;
    } else if (error.message?.includes('notFound') || error.message?.includes('404')) {
      userMessage = `Spreadsheet not found. Check the spreadsheet ID and ensure it's shared with the service account.`;
    } else if (error.message?.includes('Unable to parse range')) {
      userMessage = `Sheet "${error.message.match(/range: '([^']+)'/)?.[1] || 'unknown'}" not found. Check the sheet name.`;
    }

    return NextResponse.json({
      success: false,
      error: userMessage,
      details: error.message,
    });
  }
}
