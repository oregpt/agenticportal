/**
 * Google Sheets Data Source Adapter
 *
 * Implements the DataSourceAdapter interface for Google Sheets.
 * Uses googleapis for API access.
 *
 * Note: Google Sheets is read-only and treats sheets as tables.
 * SQL queries are NOT supported - use previewTable or executeQuery with sheet name.
 */

import { google, type sheets_v4 } from 'googleapis';
import type {
  DataSourceAdapter,
  GoogleSheetsConfig,
  DataSourceSchema,
  TableSchema,
  ColumnSchema,
  QueryResult,
  ConnectionTestResult,
} from '../types';
import { registerAdapter } from '../registry';

// Infer column types from sample data
function inferColumnType(values: unknown[]): string {
  let hasNumber = false;
  let hasBoolean = false;
  let hasDate = false;

  for (const val of values) {
    if (val === null || val === undefined || val === '') continue;

    const strVal = String(val);

    // Check boolean
    if (strVal.toLowerCase() === 'true' || strVal.toLowerCase() === 'false') {
      hasBoolean = true;
      continue;
    }

    // Check number
    if (!isNaN(Number(strVal)) && strVal.trim() !== '') {
      hasNumber = true;
      continue;
    }

    // Check date (ISO format or common patterns)
    if (/^\d{4}-\d{2}-\d{2}/.test(strVal) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(strVal)) {
      hasDate = true;
      continue;
    }

    // Otherwise it's a string, return early
    return 'string';
  }

  if (hasNumber) return 'number';
  if (hasBoolean) return 'boolean';
  if (hasDate) return 'date';
  return 'string';
}

export class GoogleSheetsAdapter implements DataSourceAdapter {
  readonly type = 'google_sheets' as const;
  private sheets: sheets_v4.Sheets;
  private config: GoogleSheetsConfig;

  constructor(config: GoogleSheetsConfig) {
    this.config = config;

    // Create OAuth2 client with tokens
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
    });

    this.sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      // Try to get spreadsheet metadata to verify access
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'properties.title',
      });

      return {
        success: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - start,
      };
    }
  }

  async getSchema(): Promise<DataSourceSchema> {
    const tables: TableSchema[] = [];

    try {
      // Get spreadsheet metadata including all sheets
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        includeGridData: false,
      });

      const sheets = response.data.sheets || [];

      for (const sheet of sheets) {
        const sheetName = sheet.properties?.title || 'Unknown';
        const rowCount = sheet.properties?.gridProperties?.rowCount || 0;

        // Get first few rows to infer schema
        try {
          const dataResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.spreadsheetId,
            range: `'${sheetName}'!A1:ZZ10`, // First 10 rows, up to column ZZ
          });

          const values = dataResponse.data.values || [];
          if (values.length === 0) {
            // Empty sheet
            tables.push({
              name: sheetName,
              columns: [],
              rowCount: 0,
            });
            continue;
          }

          // First row is headers
          const headers = values[0] as string[];
          const dataRows = values.slice(1);

          // Infer column types from sample data
          const columns: ColumnSchema[] = headers.map((header, index) => {
            const columnValues = dataRows.map((row) => row[index]);
            return {
              name: String(header || `column_${index + 1}`),
              type: inferColumnType(columnValues),
              nullable: true, // Sheets can always have empty cells
            };
          });

          tables.push({
            name: sheetName,
            columns,
            rowCount: rowCount - 1, // Subtract header row
          });
        } catch (sheetError) {
          console.warn(`Failed to get schema for sheet ${sheetName}:`, sheetError);
          tables.push({
            name: sheetName,
            columns: [],
          });
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to get Google Sheets schema: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return {
      tables,
      lastRefreshed: new Date(),
    };
  }

  /**
   * Execute a "query" on Google Sheets.
   * Since Sheets doesn't support SQL, we:
   * 1. Try to parse SQL and extract the table/sheet name
   * 2. Apply LIMIT if specified
   * 3. Fall back to interpreting input as sheet name
   */
  async executeQuery(
    sql: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult> {
    const start = Date.now();

    // Try to parse SQL and extract sheet name + limit
    let sheetName = sql.trim();
    let limit: number | undefined;
    
    // Match SQL patterns like: SELECT * FROM `table name (1)` LIMIT 5
    // Handle backticks (captures everything inside), quotes, or bare names
    const backtickMatch = sql.match(/FROM\s+`([^`]+)`(?:\s+LIMIT\s+(\d+))?/i);
    const quoteMatch = sql.match(/FROM\s+["']([^"']+)["'](?:\s+LIMIT\s+(\d+))?/i);
    const bareMatch = sql.match(/FROM\s+([\w\-+]+)(?:\s+LIMIT\s+(\d+))?/i);
    
    const sqlMatch = backtickMatch || quoteMatch || bareMatch;
    if (sqlMatch) {
      sheetName = sqlMatch[1];
      if (sqlMatch[2]) {
        limit = parseInt(sqlMatch[2], 10);
      }
      console.log('[google-sheets] Parsed SQL - sheet:', sheetName, 'limit:', limit);
    } else {
      console.log('[google-sheets] Using raw input as sheet name:', sheetName);
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: sheetName.includes('!') ? sheetName : `'${sheetName}'`,
      });

      const values = response.data.values || [];
      const executionTimeMs = Date.now() - start;

      if (values.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs,
        };
      }

      // First row is headers
      const headers = (values[0] as string[]).map((h, i) => String(h || `column_${i + 1}`));
      const dataRows = values.slice(1);

      // Infer column types
      const columns: ColumnSchema[] = headers.map((header, index) => {
        const columnValues = dataRows.map((row) => row[index]);
        return {
          name: header,
          type: inferColumnType(columnValues),
          nullable: true,
        };
      });

      // Convert rows to objects
      let rows = dataRows.map((row) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] ?? null;
        });
        return obj;
      });

      // Apply LIMIT if specified
      if (limit && limit > 0) {
        rows = rows.slice(0, limit);
      }

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs,
      };
    } catch (error) {
      console.error('[google-sheets] Query error:', error);
      throw new Error(
        `Google Sheets query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async previewTable(tableName: string, limit = 100): Promise<QueryResult> {
    const start = Date.now();

    try {
      // Get data from the specified sheet with a row limit
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `'${tableName}'!A1:ZZ${limit + 1}`, // +1 for header row
      });

      const values = response.data.values || [];
      const executionTimeMs = Date.now() - start;

      if (values.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs,
        };
      }

      // First row is headers
      const headers = (values[0] as string[]).map((h, i) => String(h || `column_${i + 1}`));
      const dataRows = values.slice(1, limit + 1);

      // Infer column types
      const columns: ColumnSchema[] = headers.map((header, index) => {
        const columnValues = dataRows.map((row) => row[index]);
        return {
          name: header,
          type: inferColumnType(columnValues),
          nullable: true,
        };
      });

      // Convert rows to objects
      const rows = dataRows.map((row) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] ?? null;
        });
        return obj;
      });

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs,
        truncated: dataRows.length >= limit,
      };
    } catch (error) {
      throw new Error(
        `Google Sheets preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async validateQuery(
    sql: string
  ): Promise<{ valid: boolean; error?: string }> {
    // For Sheets, just check that the sheet name/range is valid
    const sheetName = sql.trim();

    if (!sheetName) {
      return { valid: false, error: 'Sheet name is required' };
    }

    try {
      // Try to get metadata for the range
      await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: sheetName.includes('!') ? sheetName : `'${sheetName}'!A1`,
      });

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid sheet name or range',
      };
    }
  }

  async disconnect(): Promise<void> {
    // Google Sheets client doesn't need explicit cleanup
  }
}

// Factory function
async function createGoogleSheetsAdapter(
  config: GoogleSheetsConfig
): Promise<GoogleSheetsAdapter> {
  return new GoogleSheetsAdapter(config);
}

// Register the adapter
registerAdapter('google_sheets', createGoogleSheetsAdapter as any);

export default GoogleSheetsAdapter;
