export type McpProviderId = 'tres_finance' | 'hubspot' | 'ccview' | 'lighthouse';

export interface McpCredentialField {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
}

export interface McpProviderDefinition {
  id: McpProviderId;
  serverName: string;
  name: string;
  description: string;
  credentialFields: McpCredentialField[];
  quickCommands: Array<{ label: string; prompt: string }>;
}

export const MCP_PROVIDER_DEFINITIONS: Record<McpProviderId, McpProviderDefinition> = {
  tres_finance: {
    id: 'tres_finance',
    serverName: 'tres-finance',
    name: 'Tres Finance',
    description: 'Crypto accounting operations, balances, transactions, reconciliation, and reporting.',
    credentialFields: [
      { key: 'clientId', label: 'Client ID', required: true, placeholder: 'Tres Finance client ID' },
      { key: 'clientSecret', label: 'Client Secret', required: true, placeholder: 'Tres Finance client secret' },
      { key: 'orgName', label: 'Organization Name (optional)', required: false, placeholder: 'Optional org name header' },
    ],
    quickCommands: [
      { label: 'Dashboard Overview', prompt: 'Show me the full dashboard overview with net worth and network exposure' },
      { label: 'List Transactions', prompt: 'List the 10 most recent transactions' },
      { label: 'List Wallets', prompt: 'Show all wallets and internal accounts' },
      { label: 'Asset Balances', prompt: 'Show asset balances with fiat values in USD' },
      { label: 'Portfolio Networth', prompt: 'Show daily net worth for the last 30 days in USD' },
      { label: 'Reconciliation Audit', prompt: 'Show reconciliation audit status with any balance gaps' },
    ],
  },
  hubspot: {
    id: 'hubspot',
    serverName: 'hubspot',
    name: 'HubSpot',
    description: 'CRM for contacts, companies, deals, tickets, tasks, and notes.',
    credentialFields: [
      { key: 'accessToken', label: 'Private App Access Token', required: true, placeholder: 'pat-...' },
    ],
    quickCommands: [
      { label: 'List Contacts', prompt: 'List the most recent contacts in HubSpot' },
      { label: 'Search Contacts', prompt: 'Search for contacts with email containing @example.com' },
      { label: 'List Companies', prompt: 'List all companies in HubSpot CRM' },
      { label: 'List Deals', prompt: 'Show all open deals and their stages' },
      { label: 'List Tickets', prompt: 'Show all open support tickets' },
      { label: 'Create Task', prompt: 'Create a follow-up task for a contact' },
    ],
  },
  ccview: {
    id: 'ccview',
    serverName: 'ccview',
    name: 'CCView',
    description: 'Canton network explorer for transfers, governance, validators, rewards, and parties.',
    credentialFields: [
      { key: 'apiKey', label: 'CCView API Key', required: true, placeholder: 'X-API-Key' },
    ],
    quickCommands: [
      { label: 'Network Stats', prompt: 'Show Canton network stats and latest key metrics.' },
      { label: 'Recent Transfers', prompt: 'List recent token transfers with top counterparties.' },
      { label: 'Active Governance', prompt: 'Show active governance proposals and status.' },
      { label: 'Validator Summary', prompt: 'Summarize validator counts and performance trends.' },
      { label: 'Rewards Overview', prompt: 'Show rewards statistics and top beneficiaries.' },
    ],
  },
  lighthouse: {
    id: 'lighthouse',
    serverName: 'lighthouse',
    name: 'Lighthouse',
    description: 'Canton network explorer with public API endpoints for transfers, validators, governance, and stats.',
    credentialFields: [
      { key: 'baseUrl', label: 'Custom Base URL (optional)', required: false, placeholder: 'https://lighthouse.cantonloop.com/api' },
    ],
    quickCommands: [
      { label: 'Network Stats', prompt: 'Show overall Canton network statistics from Lighthouse.' },
      { label: 'Recent Transfers', prompt: 'List recent transfers with pagination defaults.' },
      { label: 'Validators', prompt: 'List validators and summarize key details.' },
      { label: 'Governance Stats', prompt: 'Get governance statistics and summarize trends.' },
      { label: 'Recent Transactions', prompt: 'List recent transactions and highlight notable activity.' },
    ],
  },
};

export const MCP_PROVIDER_IDS = Object.keys(MCP_PROVIDER_DEFINITIONS) as McpProviderId[];

export function isMcpProviderId(value: string): value is McpProviderId {
  return MCP_PROVIDER_IDS.includes(value as McpProviderId);
}

export function getMcpProviderDefinition(providerId: string): McpProviderDefinition | null {
  if (!isMcpProviderId(providerId)) return null;
  return MCP_PROVIDER_DEFINITIONS[providerId];
}

export function validateMcpCredentials(
  providerId: string,
  credentials: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const definition = getMcpProviderDefinition(providerId);
  if (!definition) return { valid: false, missing: ['provider'] };

  const missing = definition.credentialFields
    .filter((field) => field.required)
    .filter((field) => {
      const value = credentials[field.key];
      return typeof value !== 'string' || value.trim().length === 0;
    })
    .map((field) => field.key);

  return { valid: missing.length === 0, missing };
}

