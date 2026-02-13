/**
 * BigQuery Data Source Adapter
 *
 * Implements the DataSourceAdapter interface for Google BigQuery.
 * Ported from agenticledger-prod with adapter pattern.
 */

import { BigQuery } from '@google-cloud/bigquery';
import type {
  DataSourceAdapter,
  BigQueryConfig,
  DataSourceSchema,
  TableSchema,
  ColumnSchema,
  QueryResult,
  ConnectionTestResult,
} from '../types';
import { registerAdapter } from '../registry';

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
  GEOGRAPHY: 'string',
  RECORD: 'json',
  STRUCT: 'json',
  JSON: 'json',
};

function normalizeType(bqType: string): string {
  return TYPE_MAP[bqType.toUpperCase()] || 'string';
}

export class BigQueryAdapter implements DataSourceAdapter {
  readonly type = 'bigquery' as const;
  private config: BigQueryConfig;
  private client: BigQuery;

  constructor(config: BigQueryConfig) {
    this.config = config;
    
    // Parse service account key if it's a string
    let credentials = config.serviceAccountKey;
    if (typeof credentials === 'string') {
      try {
        credentials = JSON.parse(credentials);
      } catch {
        throw new Error('Invalid service account key JSON');
      }
    }

    this.client = new BigQuery({
      projectId: config.projectId,
      credentials: credentials as any,
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      // Simple test query
      const [job] = await this.client.createQueryJob({
        query: 'SELECT 1 as test',
        dryRun: true,
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
    const dataset = this.client.dataset(this.config.dataset);
    const [tables] = await dataset.getTables();

    const tableSchemas: TableSchema[] = [];

    for (const tableRef of tables) {
      const [metadata] = await tableRef.getMetadata();
      const fields = metadata.schema?.fields || [];

      const columns: ColumnSchema[] = fields.map((field: any) => ({
        name: field.name,
        type: normalizeType(field.type),
        nullable: field.mode !== 'REQUIRED',
        description: field.description || undefined,
      }));

      tableSchemas.push({
        name: tableRef.id || '',
        columns,
        rowCount: parseInt(metadata.numRows || '0', 10),
        description: metadata.description || undefined,
      });
    }

    return {
      tables: tableSchemas,
      lastRefreshed: new Date(),
    };
  }

  async executeQuery(
    sql: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult> {
    const start = Date.now();

    // BigQuery uses @param syntax for named parameters
    const options: any = {
      query: sql,
      params: params || {},
    };

    const [job] = await this.client.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    const metadata = job.metadata;

    const bytesProcessed = parseInt(
      metadata.statistics?.query?.totalBytesProcessed || '0',
      10
    );

    // Extract columns from first row or metadata
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
      metadata: {
        bytesProcessed,
        estimatedCost: (bytesProcessed / (1024 ** 4)) * 5, // $5 per TB
      },
    };
  }

  async previewTable(tableName: string, limit = 100): Promise<QueryResult> {
    const fullTableName = `\`${this.config.projectId}.${this.config.dataset}.${tableName}\``;
    return this.executeQuery(`SELECT * FROM ${fullTableName} LIMIT ${limit}`);
  }

  async validateQuery(
    sql: string
  ): Promise<{ valid: boolean; error?: string; estimatedCost?: number }> {
    try {
      const [job] = await this.client.createQueryJob({
        query: sql,
        dryRun: true,
      });

      const metadata = job.metadata;
      const bytesProcessed = parseInt(
        metadata.statistics?.query?.totalBytesProcessed || '0',
        10
      );
      const estimatedCost = (bytesProcessed / (1024 ** 4)) * 5;

      return {
        valid: true,
        estimatedCost,
      };
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
async function createBigQueryAdapter(config: BigQueryConfig): Promise<BigQueryAdapter> {
  return new BigQueryAdapter(config);
}

// Register the adapter
registerAdapter('bigquery', createBigQueryAdapter as any);

export default BigQueryAdapter;
