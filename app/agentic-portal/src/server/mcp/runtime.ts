import { getOrchestrator } from '@/server/mcp-hub/orchestrator';
import type { MCPOrchestrator } from '@/server/mcp-hub/orchestrator';
import { tresFinanceServer } from '@/server/mcp-servers/tres-finance/hub-server';
import { hubspotServer } from '@/server/mcp-servers/hubspot/hub-server';
import { ccviewServer } from '@/server/mcp-servers/ccview/hub-server';
import { lighthouseServer } from '@/server/mcp-servers/lighthouse/hub-server';

let initialized = false;
let initPromise: Promise<void> | null = null;

async function registerServersOnce() {
  if (initialized) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const orchestrator = getOrchestrator();
    const registry = orchestrator.serverRegistry;

    if (!registry.getServer(tresFinanceServer.name)) {
      await orchestrator.registerServer(tresFinanceServer as any);
    }
    if (!registry.getServer(hubspotServer.name)) {
      await orchestrator.registerServer(hubspotServer as any);
    }
    if (!registry.getServer(ccviewServer.name)) {
      await orchestrator.registerServer(ccviewServer as any);
    }
    if (!registry.getServer(lighthouseServer.name)) {
      await orchestrator.registerServer(lighthouseServer as any);
    }
    initialized = true;
  })();

  await initPromise;
}

export async function getPortalMcpOrchestrator(): Promise<MCPOrchestrator> {
  await registerServersOnce();
  return getOrchestrator();
}

