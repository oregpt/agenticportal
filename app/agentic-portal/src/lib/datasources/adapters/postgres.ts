/**
 * PostgreSQL Data Source Adapter
 *
 * Implements the DataSourceAdapter interface for PostgreSQL databases.
 * Uses pg (node-postgres) for connection management.
 */

import { Pool, type PoolConfig } from 'pg';
import type {
  DataSourceAdapter,
  PostgresConfig,
  DataSourceSchema,
  TableSchema,
  ColumnSchema,
  QueryResult,
  ConnectionTestResult,
} from '../types';
import { registerAdapter } from '../registry';

// Map PostgreSQL types to our normalized types
const TYPE_MAP: Record<string, string> = {
  // Numeric
  smallint: 'number',
  integer: 'number',
  bigint: 'number',
  decimal: 'number',
  numeric: 'number',
  real: 'number',
  'double precision': 'number',
  serial: 'number',
  bigserial: 'number',

  // String
  'character varying': 'string',
  varchar: 'string',
  character: 'string',
  char: 'string',
  text: 'string',
  uuid: 'string',

  // Boolean
  boolean: 'boolean',

  // Date/Time
  date: 'date',
  timestamp: 'datetime',
  'timestamp without time zone': 'datetime',
  'timestamp with time zone': 'datetime',
  time: 'string',
  interval: 'string',

  // JSON
  json: 'json',
  jsonb: 'json',

  // Arrays (treat as json for now)
  array: 'json',
};

function normalizeType(pgType: string): string {
  const lower = pgType.toLowerCase();
  return TYPE_MAP[lower] || 'string';
}

export class PostgresAdapter implements DataSourceAdapter {
  readonly type = 'postgres' as const;
  private pool: Pool;
  private config: PostgresConfig;

  constructor(config: PostgresConfig) {
    this.config = config;

    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 5, // Max connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    this.pool = new Pool(poolConfig);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
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
    const tablesQuery = `
      SELECT
        t.table_name,
        obj_description(('"' || t.table_schema || '"."' || t.table_name || '"')::regclass) as table_comment
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `;

    const columnsQuery = `
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        col_description(('"public"."' || c.table_name || '"')::regclass, c.ordinal_position) as column_comment,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `;

    const [tablesResult, columnsResult] = await Promise.all([
      this.pool.query(tablesQuery),
      this.pool.query(columnsQuery),
    ]);

    // Group columns by table
    const columnsByTable = new Map<string, ColumnSchema[]>();
    for (const row of columnsResult.rows) {
      const tableName = row.table_name;
      if (!columnsByTable.has(tableName)) {
        columnsByTable.set(tableName, []);
      }
      columnsByTable.get(tableName)!.push({
        name: row.column_name,
        type: normalizeType(row.data_type),
        nullable: row.is_nullable === 'YES',
        description: row.column_comment || undefined,
        isPrimaryKey: row.is_primary_key,
      });
    }

    // Build table schemas
    const tables: TableSchema[] = tablesResult.rows.map((row) => ({
      name: row.table_name,
      columns: columnsByTable.get(row.table_name) || [],
      description: row.table_comment || undefined,
    }));

    return {
      tables,
      lastRefreshed: new Date(),
    };
  }

  async executeQuery(
    sql: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult> {
    const start = Date.now();

    // Convert named params to positional if needed
    let finalSql = sql;
    const values: unknown[] = [];

    if (params) {
      let paramIndex = 1;
      finalSql = sql.replace(/:(\w+)/g, (_, name) => {
        values.push(params[name]);
        return `$${paramIndex++}`;
      });
    }

    const result = await this.pool.query(finalSql, values);
    const executionTimeMs = Date.now() - start;

    // Extract column info from result fields
    const columns: ColumnSchema[] = result.fields.map((field) => ({
      name: field.name,
      type: 'string', // pg doesn't give us type info easily in results
      nullable: true,
    }));

    return {
      columns,
      rows: result.rows,
      rowCount: result.rowCount || 0,
      executionTimeMs,
    };
  }

  async previewTable(tableName: string, limit = 100): Promise<QueryResult> {
    // Sanitize table name to prevent SQL injection
    const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    return this.executeQuery(`SELECT * FROM "${safeName}" LIMIT ${limit}`);
  }

  async validateQuery(
    sql: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Use EXPLAIN to validate without executing
      await this.pool.query(`EXPLAIN ${sql}`);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}

// Factory function
async function createPostgresAdapter(config: PostgresConfig): Promise<PostgresAdapter> {
  return new PostgresAdapter(config);
}

// Register the adapter
registerAdapter('postgres', createPostgresAdapter as any);

export default PostgresAdapter;
