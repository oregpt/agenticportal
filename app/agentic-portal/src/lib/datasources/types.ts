/**
 * Data Source Abstraction Layer
 *
 * This interface decouples the upper layers (Views, Widgets, AI Chat)
 * from specific database implementations. Any SQL-compatible data source
 * can implement this interface.
 *
 * Supported today: PostgreSQL, BigQuery, Google Sheets
 * Future: MySQL, Snowflake, Redshift, Databricks, etc.
 */

export type DataSourceType = 'postgres' | 'bigquery' | 'google_sheets' | 'google_sheets_live' | 'csv' | 'mcp_server';

export interface ColumnSchema {
  name: string;
  type: string; // Normalized type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json'
  nullable: boolean;
  description?: string;
  isPrimaryKey?: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  rowCount?: number;
  description?: string;
}

export interface DataSourceSchema {
  tables: TableSchema[];
  lastRefreshed: Date;
}

export interface QueryResult {
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  truncated?: boolean;
  metadata?: {
    bytesProcessed?: number;
    estimatedCost?: number;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  latencyMs?: number;
}

/**
 * Base configuration all data sources share
 */
export interface BaseDataSourceConfig {
  id: string;
  organizationId: string;
  name: string;
  type: DataSourceType;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * PostgreSQL-specific config
 */
export interface PostgresConfig extends BaseDataSourceConfig {
  type: 'postgres';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string; // Encrypted at rest
  ssl?: boolean;
}

/**
 * BigQuery-specific config
 */
export interface BigQueryConfig extends BaseDataSourceConfig {
  type: 'bigquery';
  projectId: string;
  dataset: string;
  serviceAccountKey: string; // Encrypted JSON
}

/**
 * Google Sheets-specific config
 */
export interface GoogleSheetsConfig extends BaseDataSourceConfig {
  type: 'google_sheets';
  spreadsheetId: string;
  sheetName?: string;
  accessToken: string; // Encrypted
  refreshToken: string; // Encrypted
}

export interface McpServerConfig extends BaseDataSourceConfig {
  type: 'mcp_server';
  provider: string;
  credentials: Record<string, string>;
}

export type DataSourceConfig =
  | PostgresConfig
  | BigQueryConfig
  | GoogleSheetsConfig
  | McpServerConfig;

/**
 * The adapter interface that all data sources must implement.
 * This is the contract that keeps upper layers decoupled.
 */
export interface DataSourceAdapter {
  /**
   * Unique identifier for this adapter type
   */
  readonly type: DataSourceType;

  /**
   * Test if the connection is valid
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Discover the schema (tables, columns, types)
   */
  getSchema(): Promise<DataSourceSchema>;

  /**
   * Execute a SQL query and return results
   */
  executeQuery(sql: string, params?: Record<string, unknown>): Promise<QueryResult>;

  /**
   * Get a preview of data from a table (for schema exploration)
   */
  previewTable(tableName: string, limit?: number): Promise<QueryResult>;

  /**
   * Validate SQL syntax without executing (dry run)
   */
  validateQuery?(sql: string): Promise<{ valid: boolean; error?: string; estimatedCost?: number }>;

  /**
   * Clean up resources (connection pools, etc.)
   */
  disconnect(): Promise<void>;
}

/**
 * Factory function type for creating adapters
 */
export type AdapterFactory = (config: DataSourceConfig) => Promise<DataSourceAdapter>;
