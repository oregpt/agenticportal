import { getPortalMcpOrchestrator } from './runtime';
import { getMcpProviderDefinition, type McpProviderId, validateMcpCredentials } from './providers';

export interface McpSourceConfigInput {
  provider: McpProviderId;
  credentials: Record<string, string>;
}

function setServerTokens(serverName: string, credentials: Record<string, string>) {
  if (serverName === 'tres-finance') {
    return {
      token1: credentials.clientId,
      token2: credentials.clientSecret,
      token3: credentials.orgName || undefined,
    };
  }
  if (serverName === 'hubspot') {
    return {
      token1: credentials.accessToken,
    };
  }
  return {};
}

export async function testMcpSourceConfig(config: McpSourceConfigInput): Promise<{ success: boolean; message?: string; error?: string }> {
  const definition = getMcpProviderDefinition(config.provider);
  if (!definition) return { success: false, error: 'Unsupported MCP provider' };
  const validation = validateMcpCredentials(config.provider, config.credentials);
  if (!validation.valid) {
    return { success: false, error: `Missing required credentials: ${validation.missing.join(', ')}` };
  }

  try {
    const orchestrator = await getPortalMcpOrchestrator();
    const server = orchestrator.serverRegistry.getServer(definition.serverName) as any;
    if (!server) return { success: false, error: 'MCP server not registered' };
    if (typeof server.setTokens === 'function') {
      server.setTokens(setServerTokens(definition.serverName, config.credentials));
    }
    const tools = await server.listTools();
    return {
      success: true,
      message: `Connected successfully. ${tools.length} tools available.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize MCP server',
    };
  }
}

export async function buildMcpSchemaCache(provider: McpProviderId): Promise<{
  tables: Array<{ name: string; columns: Array<{ name: string; type: string; nullable: boolean }> }>;
  tools: Array<{ name: string; description: string }>;
}> {
  const definition = getMcpProviderDefinition(provider);
  if (!definition) return { tables: [], tools: [] };
  const orchestrator = await getPortalMcpOrchestrator();
  const server = orchestrator.serverRegistry.getServer(definition.serverName);
  if (!server) return { tables: [], tools: [] };
  const tools = await server.listTools();
  const pseudoColumns = tools.slice(0, 80).map((tool) => ({
    name: tool.name,
    type: 'tool',
    nullable: false,
  }));
  return {
    tables: [{ name: `${definition.serverName}_tools`, columns: pseudoColumns }],
    tools: tools.map((tool) => ({ name: tool.name, description: tool.description })),
  };
}

