/**
 * Google Sheets Live Data Source Adapter
 *
 * Queries Google Sheets via BigQuery External Tables.
 * The sheet data is accessed in real-time through BigQuery SQL.
 */

import { BigQuery } from '@google-cloud/bigquery';
import type {
  DataSourceAdapter,
  DataSourceSchema,
  TableSchema,
  ColumnSchema,
  QueryResult,
  ConnectionTestResult,
} from '../types';
import { registerAdapter } from '../registry';
import { loadPlatformGcpCredentials } from '@/lib/gcpCredentials';

const GOOGLE_SHEETS_BIGQUERY_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/drive.readonly',
];

// Map BigQuery types to our normalized types
const TYPE_MAP: Record<string, string> = {
  STRING: 'string',
  BYTES: 'string',
  INTEGER: 'number',
  INT64: 'number',
  FLOAT: 'number',
  FLOAT64: 'number',
  NUMERIC: 'number',
  BIGNUMERIC: 'number',
  BOOLEAN: 'boolean',
  BOOL: 'boolean',
  TIMESTAMP: 'datetime',
  DATE: 'date',
  TIME: 'string',
  DATETIME: 'datetime',
};

function normalizeType(bqType: string): string {
  return TYPE_MAP[bqType.toUpperCase()] || 'string';
}

interface GoogleSheetsLiveConfig {
  id: string;
  organizationId: string;
  name: string;
  type: 'google_sheets_live';
  spreadsheetId: string;
  sheetName: string;
  hasHeader?: boolean;
  externalTableFQN: string;
  bqProjectId: string;
  bqDataset: string;
  bqTableName: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function getPlatformCredentials() {
  const { credentials } = loadPlatformGcpCredentials();
  if (!credentials) {
    throw new Error('Platform GCP credentials not configured');
  }
  return credentials;
}

export class GoogleSheetsLiveAdapter implements DataSourceAdapter {
  readonly type = 'google_sheets_live' as const;
  private config: GoogleSheetsLiveConfig;
  private client: BigQuery;

  constructor(config: GoogleSheetsLiveConfig) {
    this.config = config;
    
    const credentials = getPlatformCredentials();
    this.client = new BigQuery({
      projectId: config.bqProjectId,
      credentials,
      scopes: GOOGLE_SHEETS_BIGQUERY_SCOPES,
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      // Test by counting rows
      const [rows] = await this.client.query({
        query: `SELECT COUNT(*) as cnt FROM \`${this.config.externalTableFQN}\` LIMIT 1`,
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
    const dataset = this.client.dataset(this.config.bqDataset);
    const table = dataset.table(this.config.bqTableName);
    
    const [metadata] = await table.getMetadata();
    const fields = metadata.schema?.fields || [];

    const columns: ColumnSchema[] = fields.map((field: any) => ({
      name: field.name,
      type: normalizeType(field.type),
      nullable: field.mode !== 'REQUIRED',
      description: field.description || undefined,
    }));

    // Get row count
    const [countResult] = await this.client.query({
      query: `SELECT COUNT(*) as cnt FROM \`${this.config.externalTableFQN}\``,
    });
    const rowCount = parseInt(countResult[0]?.cnt || '0', 10);

    const tableSchema: TableSchema = {
      name: this.config.sheetName,
      columns,
      rowCount,
      description: `Google Sheet: ${this.config.spreadsheetId}`,
    };

    return {
      tables: [tableSchema],
      lastRefreshed: new Date(),
    };
  }

  async executeQuery(
    sql: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult> {
    const start = Date.now();

    // Replace table references with the full BigQuery table name
    // This allows users to write simpler queries
    let processedSql = sql;
    
    // If query doesn't include the full table name, assume it's querying this sheet
    if (!sql.includes(this.config.externalTableFQN) && !sql.includes('`')) {
      // Match table names including hyphens, underscores, and alphanumeric chars
      processedSql = sql.replace(
        /FROM\s+["']?([\w\-]+)["']?/gi,
        `FROM \`${this.config.externalTableFQN}\``
      );
    }
    
    console.log('[google-sheets-live] Executing SQL:', processedSql);

    const options: any = {
      query: processedSql,
      params: params || {},
    };

    const [job] = await this.client.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    const metadata = job.metadata;

    // Extract columns from metadata or first row
    const columns: ColumnSchema[] = [];
    if (metadata.schema?.fields) {
      for (const field of metadata.schema.fields) {
        columns.push({
          name: field.name,
          type: normalizeType(field.type),
          nullable: field.mode !== 'REQUIRED',
        });
      }
    } else if (rows.length > 0) {
      for (const key of Object.keys(rows[0])) {
        columns.push({
          name: key,
          type: 'string',
          nullable: true,
        });
      }
    }

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async previewTable(tableName: string, limit = 100): Promise<QueryResult> {
    return this.executeQuery(`SELECT * FROM \`${this.config.externalTableFQN}\` LIMIT ${limit}`);
  }

  async validateQuery(
    sql: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const [job] = await this.client.createQueryJob({
        query: sql,
        dryRun: true,
      });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnect(): Promise<void> {
    // BigQuery client doesn't need explicit cleanup
  }
}

// Factory function
async function createGoogleSheetsLiveAdapter(config: GoogleSheetsLiveConfig): Promise<GoogleSheetsLiveAdapter> {
  return new GoogleSheetsLiveAdapter(config);
}

// Register the adapter
registerAdapter('google_sheets_live', createGoogleSheetsLiveAdapter as any);

export default GoogleSheetsLiveAdapter;
