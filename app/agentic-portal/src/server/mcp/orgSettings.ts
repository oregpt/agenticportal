import type { McpProviderId } from './providers';
import { isMcpProviderId } from './providers';

export interface OrgMcpSettings {
  enableMcpDataSources: boolean;
  enabledMcpProviders: McpProviderId[];
}

export function normalizeOrgMcpSettings(rawSettings: unknown): OrgMcpSettings {
  const settings = (rawSettings || {}) as Record<string, unknown>;
  const enableMcpDataSources = settings.enableMcpDataSources === true;
  const enabledMcpProvidersRaw = Array.isArray(settings.enabledMcpProviders) ? settings.enabledMcpProviders : [];
  const enabledMcpProviders = Array.from(
    new Set(
      enabledMcpProvidersRaw
        .map((value) => String(value || '').trim())
        .filter((value): value is McpProviderId => isMcpProviderId(value))
    )
  );
  return { enableMcpDataSources, enabledMcpProviders };
}

export function mergeOrgMcpSettings(
  currentSettings: Record<string, unknown>,
  patch: Partial<OrgMcpSettings>
): Record<string, unknown> {
  const current = normalizeOrgMcpSettings(currentSettings);
  return {
    ...currentSettings,
    enableMcpDataSources:
      typeof patch.enableMcpDataSources === 'boolean' ? patch.enableMcpDataSources : current.enableMcpDataSources,
    enabledMcpProviders: Array.isArray(patch.enabledMcpProviders)
      ? patch.enabledMcpProviders.filter((value): value is McpProviderId => isMcpProviderId(String(value)))
      : current.enabledMcpProviders,
  };
}

