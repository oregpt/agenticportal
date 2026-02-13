/**
 * Capability Service - Stub
 *
 * Manages per-agent API keys and capabilities.
 * TODO: Port full implementation from AgentHub
 */

// Get per-agent API key with fallback to environment variable
export async function getAgentApiKeyWithFallback(
  agentId: string,
  keyName: string
): Promise<string | null> {
  // For now, just return null to use environment variable fallback
  // TODO: Implement database lookup for per-agent keys
  return null;
}

export async function getAgentCapabilities(agentId: string): Promise<string[]> {
  // TODO: Implement database lookup
  return [];
}
