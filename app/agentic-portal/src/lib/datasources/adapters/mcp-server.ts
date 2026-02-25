import {
  type DataSourceAdapter,
  type ConnectionTestResult,
  type DataSourceSchema,
  type QueryResult,
  type DataSourceType,
  type DataSourceConfig,
} from '@/lib/datasources/types';
import { registerAdapter } from '@/lib/datasources/registry';
import { buildMcpSchemaCache, testMcpSourceConfig } from '@/server/mcp/testing';
import { isMcpProviderId } from '@/server/mcp/providers';

type McpConfig = DataSourceConfig & {
  type: 'mcp_server';
  provider: string;
  credentials: Record<string, string>;
};

class McpServerAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'mcp_server';

  constructor(private readonly config: McpConfig) {}

  async testConnection(): Promise<ConnectionTestResult> {
    if (!isMcpProviderId(this.config.provider)) {
      return { success: false, error: 'Unsupported MCP provider' };
    }
    const result = await testMcpSourceConfig({
      provider: this.config.provider,
      credentials: this.config.credentials || {},
    });
    return {
      success: result.success,
      error: result.error,
      latencyMs: 0,
    };
  }

  async getSchema(): Promise<DataSourceSchema> {
    if (!isMcpProviderId(this.config.provider)) {
      return { tables: [], lastRefreshed: new Date() };
    }
    const payload = await buildMcpSchemaCache(this.config.provider);
    return {
      tables: payload.tables.map((table) => ({
        name: table.name,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          nullable: column.nullable,
        })),
      })),
      lastRefreshed: new Date(),
    };
  }

  async executeQuery(): Promise<QueryResult> {
    throw new Error('SQL query execution is not supported for MCP Server sources.');
  }

  async previewTable(): Promise<QueryResult> {
    throw new Error('Table preview is not supported for MCP Server sources.');
  }

  async disconnect(): Promise<void> {
    return;
  }
}

registerAdapter('mcp_server', async (config: DataSourceConfig) => new McpServerAdapter(config as McpConfig));

