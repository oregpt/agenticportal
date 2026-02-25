import { z } from 'zod';
import { TresFinanceClient } from './api-client';
import { tools } from './tools';
import type { MCPResponse, MCPServerInstance, MCPTool, MCPToolContext } from '@/server/mcp-hub/types';
import { getMcpSourceCredentials } from '@/server/mcp/sourceCredentials';

const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedClient {
  client: TresFinanceClient;
  createdAt: number;
}

export class TresFinanceMCPServer implements MCPServerInstance {
  name = 'tres-finance';
  version = '1.0.0';
  description = 'Crypto accounting: transactions, wallets, balances, positions, cost basis, reconciliation, reporting';
  tools: MCPTool[] = [];

  private client: TresFinanceClient | null = null;
  private sourceClients: Map<string, CachedClient> = new Map();

  setTokens(tokens: { token1?: string; token2?: string; token3?: string }) {
    if (tokens.token1 && tokens.token2) {
      this.client = new TresFinanceClient(tokens.token1, tokens.token2, undefined, undefined, tokens.token3);
    }
  }

  private async getClientForSource(sourceId: string, organizationId?: string): Promise<TresFinanceClient | null> {
    const cached = this.sourceClients.get(sourceId);
    if (cached && Date.now() - cached.createdAt < CLIENT_CACHE_TTL_MS) {
      return cached.client;
    }
    if (cached) this.sourceClients.delete(sourceId);

    try {
      const payload = await getMcpSourceCredentials({
        sourceId,
        organizationId,
        expectedProvider: 'tres_finance',
      });

      if (payload?.credentials.clientId && payload?.credentials.clientSecret) {
        const client = new TresFinanceClient(
          payload.credentials.clientId,
          payload.credentials.clientSecret,
          undefined,
          undefined,
          payload.credentials.orgName || undefined
        );
        this.sourceClients.set(sourceId, { client, createdAt: Date.now() });
        return client;
      }
    } catch (error) {
      console.warn('[tres-finance] Failed to load credentials for source', sourceId, error);
    }

    return null;
  }

  async initialize(): Promise<void> {
    this.tools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as z.ZodType<any>,
    }));
    console.log(`[tres-finance] Initialized with ${this.tools.length} tools`);
  }

  clearAgentCache(agentId: string): void {
    this.sourceClients.delete(agentId);
  }

  async shutdown(): Promise<void> {
    this.client = null;
    this.sourceClients.clear();
  }

  async executeTool(name: string, args: Record<string, unknown>, context?: MCPToolContext): Promise<MCPResponse> {
    let activeClient: TresFinanceClient | null = null;

    if (context?.sourceId) {
      activeClient = await this.getClientForSource(context.sourceId, context.organizationId);
    }

    if (!activeClient) {
      activeClient = this.client;
    }

    if (!activeClient) {
      return {
        success: false,
        error: context?.sourceId
          ? 'No credentials configured for this source. Update MCP credentials in Data Sources.'
          : 'Server not configured - call setTokens() first',
      };
    }

    const tool = tools.find((t) => t.name === name);
    if (!tool) return { success: false, error: `Unknown tool: ${name}` };

    const start = Date.now();
    try {
      const result = await tool.handler(activeClient, args as any);
      return {
        success: true,
        data: result,
        metadata: {
          server: this.name,
          tool: name,
          executionTime: Date.now() - start,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
        metadata: {
          server: this.name,
          tool: name,
          executionTime: Date.now() - start,
        },
      };
    }
  }

  async listTools(): Promise<MCPTool[]> {
    return this.tools;
  }
}

export const tresFinanceServer = new TresFinanceMCPServer();
