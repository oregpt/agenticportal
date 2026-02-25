import { z } from 'zod';
import { CCViewClient } from './api-client';
import { tools } from './tools';
import type { MCPResponse, MCPServerInstance, MCPTool, MCPToolContext } from '@/server/mcp-hub/types';
import { getMcpSourceCredentials } from '@/server/mcp/sourceCredentials';

const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedClient {
  client: CCViewClient;
  createdAt: number;
}

export class CCViewMCPServer implements MCPServerInstance {
  name = 'ccview';
  version = '1.0.0';
  description = 'Canton network explorer: transfers, governance, validators, rewards, parties, mining';
  tools: MCPTool[] = [];

  private client: CCViewClient | null = null;
  private sourceClients: Map<string, CachedClient> = new Map();

  setTokens(tokens: { token1?: string }) {
    if (tokens.token1) this.client = new CCViewClient(tokens.token1);
  }

  private async getClientForSource(sourceId: string, organizationId?: string): Promise<CCViewClient | null> {
    const cached = this.sourceClients.get(sourceId);
    if (cached && Date.now() - cached.createdAt < CLIENT_CACHE_TTL_MS) {
      return cached.client;
    }
    if (cached) this.sourceClients.delete(sourceId);

    try {
      const payload = await getMcpSourceCredentials({
        sourceId,
        organizationId,
        expectedProvider: 'ccview',
      });
      if (payload?.credentials.apiKey) {
        const client = new CCViewClient(payload.credentials.apiKey);
        this.sourceClients.set(sourceId, { client, createdAt: Date.now() });
        return client;
      }
    } catch (error) {
      console.warn('[ccview] Failed to load credentials for source', sourceId, error);
    }

    return null;
  }

  async initialize(): Promise<void> {
    this.tools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as z.ZodType<any>,
    }));
    console.log(`[ccview] Initialized with ${this.tools.length} tools`);
  }

  clearAgentCache(agentId: string): void {
    this.sourceClients.delete(agentId);
  }

  async shutdown(): Promise<void> {
    this.client = null;
    this.sourceClients.clear();
  }

  async executeTool(name: string, args: Record<string, unknown>, context?: MCPToolContext): Promise<MCPResponse> {
    let activeClient: CCViewClient | null = null;

    if (context?.sourceId) {
      activeClient = await this.getClientForSource(context.sourceId, context.organizationId);
    }

    if (!activeClient) activeClient = this.client;

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

export const ccviewServer = new CCViewMCPServer();
