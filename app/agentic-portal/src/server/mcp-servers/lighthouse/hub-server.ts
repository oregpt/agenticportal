import { z } from 'zod';
import { LighthouseClient } from './api-client';
import { tools } from './tools';
import type { MCPResponse, MCPServerInstance, MCPTool, MCPToolContext } from '@/server/mcp-hub/types';
import { getMcpSourceCredentials } from '@/server/mcp/sourceCredentials';

const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedClient {
  client: LighthouseClient;
  createdAt: number;
}

export class LighthouseMCPServer implements MCPServerInstance {
  name = 'lighthouse';
  version = '1.0.0';
  description = 'Canton network explorer: validators, governance, transfers, and transactions';
  tools: MCPTool[] = [];

  private client: LighthouseClient = new LighthouseClient();
  private sourceClients: Map<string, CachedClient> = new Map();

  setTokens(tokens: { token1?: string }) {
    this.client = new LighthouseClient(tokens.token1 || undefined);
  }

  private async getClientForSource(sourceId: string, organizationId?: string): Promise<LighthouseClient | null> {
    const cached = this.sourceClients.get(sourceId);
    if (cached && Date.now() - cached.createdAt < CLIENT_CACHE_TTL_MS) {
      return cached.client;
    }
    if (cached) this.sourceClients.delete(sourceId);

    try {
      const payload = await getMcpSourceCredentials({
        sourceId,
        organizationId,
        expectedProvider: 'lighthouse',
      });
      const baseUrl = payload?.credentials.baseUrl || undefined;
      const client = new LighthouseClient(baseUrl);
      this.sourceClients.set(sourceId, { client, createdAt: Date.now() });
      return client;
    } catch (error) {
      console.warn('[lighthouse] Failed to load credentials for source', sourceId, error);
      return null;
    }
  }

  async initialize(): Promise<void> {
    this.tools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as z.ZodType<any>,
    }));
    console.log(`[lighthouse] Initialized with ${this.tools.length} tools`);
  }

  clearAgentCache(agentId: string): void {
    this.sourceClients.delete(agentId);
  }

  async shutdown(): Promise<void> {
    this.client = new LighthouseClient();
    this.sourceClients.clear();
  }

  async executeTool(name: string, args: Record<string, unknown>, context?: MCPToolContext): Promise<MCPResponse> {
    let activeClient: LighthouseClient | null = null;
    if (context?.sourceId) {
      activeClient = await this.getClientForSource(context.sourceId, context.organizationId);
    }
    if (!activeClient) activeClient = this.client;

    const tool = tools.find((t) => t.name === name);
    if (!tool) return { success: false, error: `Unknown tool: ${name}` };

    const start = Date.now();
    try {
      const result = await tool.handler(activeClient, args as any);
      return {
        success: true,
        data: result,
        metadata: { server: this.name, tool: name, executionTime: Date.now() - start },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
        metadata: { server: this.name, tool: name, executionTime: Date.now() - start },
      };
    }
  }

  async listTools(): Promise<MCPTool[]> {
    return this.tools;
  }
}

export const lighthouseServer = new LighthouseMCPServer();
