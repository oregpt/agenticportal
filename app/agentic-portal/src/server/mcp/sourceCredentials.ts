import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getMcpProviderDefinition, type McpProviderId, validateMcpCredentials } from './providers';

export interface McpSourceCredentialsPayload {
  provider: McpProviderId;
  credentials: Record<string, string>;
}

export async function getMcpSourceCredentials(input: {
  sourceId: string;
  organizationId?: string;
  expectedProvider?: string;
}): Promise<McpSourceCredentialsPayload | null> {
  const clauses = [eq(schema.dataSources.id, input.sourceId)];
  if (input.organizationId) clauses.push(eq(schema.dataSources.organizationId, input.organizationId));
  const [row] = await db
    .select()
    .from(schema.dataSources)
    .where(and(...clauses))
    .limit(1);

  if (!row || row.type !== 'mcp_server') return null;

  const config = (row.config || {}) as Record<string, unknown>;
  const provider = String(config.provider || '').trim();
  const definition = getMcpProviderDefinition(provider);
  if (!definition) return null;
  if (input.expectedProvider && provider !== input.expectedProvider) return null;

  const credentialsRaw = (config.credentials || {}) as Record<string, unknown>;
  const credentials = Object.fromEntries(
    Object.entries(credentialsRaw).map(([key, value]) => [key, String(value ?? '')])
  ) as Record<string, string>;
  const validation = validateMcpCredentials(provider, credentialsRaw);
  if (!validation.valid) return null;

  return {
    provider: definition.id,
    credentials,
  };
}

