import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { MCP_PROVIDER_DEFINITIONS } from '@/server/mcp/providers';
import { normalizeOrgMcpSettings } from '@/server/mcp/orgSettings';

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, user.organizationId))
    .limit(1);
  const settings = normalizeOrgMcpSettings(org?.settings || {});

  const providers = settings.enabledMcpProviders
    .map((providerId) => MCP_PROVIDER_DEFINITIONS[providerId])
    .filter(Boolean)
    .map((provider) => ({
      id: provider.id,
      serverName: provider.serverName,
      name: provider.name,
      description: provider.description,
      credentialFields: provider.credentialFields,
      quickCommands: provider.quickCommands,
    }));

  return NextResponse.json({
    enabled: settings.enableMcpDataSources,
    providers,
  });
}

