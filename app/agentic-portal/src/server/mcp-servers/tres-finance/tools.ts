import { z } from 'zod';
import { TresFinanceClient } from './api-client';

/**
 * Tres Finance MCP Tool Definitions
 * 65 tools covering: Overview, Transactions, Wallets, Positions, Assets, Portfolio,
 * Balances, Trial Balance, Staking, Labels, Reconciliation, Cost Basis, Integrations,
 * Invoices, Reports, Roll Forward, Notifications, Workflows, Tax, Organization,
 * Counter-Party, Pricing, Audit, AI Agent
 */

interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  handler: (client: TresFinanceClient, args: any) => Promise<any>;
}

export const tools: ToolDef[] = [

  // ===== Overview & Dashboard (6) =====

  {
    name: 'overview_net_worth',
    description: 'Get organization net worth across all wallets',
    inputSchema: z.object({
      currency: z.string().optional().describe('Currency code (e.g. USD, EUR). Uses enum format'),
    }),
    handler: async (client, args) => client.getOverviewNetWorth(args.currency),
  },

  {
    name: 'overview_network_exposure',
    description: 'Get network/blockchain exposure breakdown',
    inputSchema: z.object({
      currency: z.string().describe('Currency code (e.g. USD) — required'),
    }),
    handler: async (client, args) => client.getOverviewNetworkExposure(args.currency),
  },

  {
    name: 'overview_daily_inflow_outflow',
    description: 'Get daily inflow/outflow chart data for a period',
    inputSchema: z.object({
      start_date: z.string().describe('Start date (ISO 8601, e.g. 2024-01-01)'),
      end_date: z.string().describe('End date (ISO 8601)'),
      currency: z.string().optional().describe('Currency code'),
    }),
    handler: async (client, args) => client.getOverviewDailyInflowOutflow(args.start_date, args.end_date, args.currency),
  },

  {
    name: 'overview_underlying_assets',
    description: 'Get underlying asset allocation breakdown',
    inputSchema: z.object({
      currency: z.string().describe('Currency code (e.g. USD) — required'),
    }),
    handler: async (client, args) => client.getOverviewUnderlyingAssets(args.currency),
  },

  {
    name: 'overview_application_summary',
    description: 'Get DeFi/CeFi application summary with positions',
    inputSchema: z.object({
      currency: z.string().optional().describe('Currency code'),
      platforms: z.array(z.string()).optional().describe('Filter by platform names'),
    }),
    handler: async (client, args) => client.getOverviewApplicationSummary(args.currency, args.platforms),
  },

  {
    name: 'overview_full_dashboard',
    description: 'Get complete dashboard: net worth + exposure + assets',
    inputSchema: z.object({
      currency: z.string().optional().describe('Currency code (default: USD)'),
    }),
    handler: async (client, args) => client.getOverviewFull(args.currency),
  },

  // ===== Transactions (4) =====

  {
    name: 'transaction_list',
    description: 'List transactions with pagination and filters',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results (default 20)'),
      after: z.string().optional().describe('Pagination cursor'),
      platform: z.string().optional().describe('Filter by platform (e.g. ETHEREUM)'),
      direction: z.string().optional().describe('Filter: IN or OUT'),
      status: z.string().optional().describe('Filter by status'),
      timestamp_gte: z.string().optional().describe('From date (ISO 8601)'),
      timestamp_lte: z.string().optional().describe('To date (ISO 8601)'),
      hash: z.string().optional().describe('Filter by transaction hash'),
      bookmark: z.boolean().optional().describe('Filter bookmarked only'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.platform) filters.platform = args.platform;
      if (args.direction) filters.direction = args.direction;
      if (args.status) filters.status = args.status;
      if (args.timestamp_gte) filters.timestamp_Gte = args.timestamp_gte;
      if (args.timestamp_lte) filters.timestamp_Lte = args.timestamp_lte;
      if (args.hash) filters.hash = args.hash;
      if (args.bookmark !== undefined) filters.bookmark = args.bookmark;
      return client.listTransactions(args.first, args.after, filters);
    },
  },

  {
    name: 'transaction_summary',
    description: 'Get transaction volume summary and statistics',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results (default 5)'),
    }),
    handler: async (client, args) => client.getTransactionSummary(args.first),
  },

  {
    name: 'sub_transaction_list',
    description: 'List sub-transactions with filters (use filters!)',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results (max 50 recommended)'),
      after: z.string().optional().describe('Pagination cursor'),
      platform: z.string().optional().describe('Filter by platform'),
      direction: z.string().optional().describe('IN or OUT'),
      financial_action: z.string().optional().describe('Filter by action type'),
      asset_symbol: z.string().optional().describe('Filter by asset symbol'),
      timestamp_gte: z.string().optional().describe('From date (ISO 8601)'),
      timestamp_lte: z.string().optional().describe('To date (ISO 8601)'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.platform) filters.asset_Platform = args.platform;
      if (args.direction) filters.direction = args.direction;
      if (args.financial_action) filters.financialAction = args.financial_action;
      if (args.asset_symbol) filters.asset_Name_Icontains = args.asset_symbol;
      if (args.timestamp_gte) filters.timestamp_Gte = args.timestamp_gte;
      if (args.timestamp_lte) filters.timestamp_Lte = args.timestamp_lte;
      return client.listSubTransactions(args.first || 20, args.after, filters);
    },
  },

  {
    name: 'transaction_classify',
    description: 'Auto-classify transactions by their IDs',
    inputSchema: z.object({
      transaction_ids: z.array(z.string()).describe('Transaction IDs to classify'),
    }),
    handler: async (client, args) => client.classifyTransactions(args.transaction_ids),
  },

  // ===== Wallets / Internal Accounts (4) =====

  {
    name: 'wallet_list',
    description: 'List wallets/internal accounts with filters',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      after: z.string().optional().describe('Pagination cursor'),
      platform: z.string().optional().describe('Filter by platform'),
      status: z.string().optional().describe('Filter by status'),
      name_contains: z.string().optional().describe('Search by name'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.platform) filters.platform = args.platform;
      if (args.status) filters.status = args.status;
      if (args.name_contains) filters.name_Icontains = args.name_contains;
      return client.listWallets(args.first, args.after, filters);
    },
  },

  {
    name: 'wallet_update',
    description: 'Update wallet/internal account name or settings',
    inputSchema: z.object({
      id: z.string().describe('Internal account ID'),
      name: z.string().optional().describe('New display name'),
      status: z.string().optional().describe('New status'),
    }),
    handler: async (client, args) => {
      const updates: Record<string, any> = {};
      if (args.name) updates.name = args.name;
      if (args.status) updates.status = args.status;
      return client.updateInternalAccount(args.id, updates);
    },
  },

  {
    name: 'wallet_set_tags',
    description: 'Set tags on a wallet/internal account',
    inputSchema: z.object({
      internal_account_id: z.string().describe('Internal account ID'),
      tag_ids: z.array(z.string()).describe('Tag IDs to assign'),
    }),
    handler: async (client, args) => client.setInternalAccountTags(args.internal_account_id, args.tag_ids),
  },

  {
    name: 'wallet_update_statuses',
    description: 'Bulk update wallet statuses',
    inputSchema: z.object({
      ids: z.array(z.string()).describe('Internal account IDs'),
      status: z.string().describe('New status for all'),
    }),
    handler: async (client, args) => client.updateInternalAccountStatuses(args.ids, args.status),
  },

  // ===== Positions (1) =====

  {
    name: 'position_list',
    description: 'List DeFi/staking positions across protocols',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      after: z.string().optional().describe('Pagination cursor'),
      type: z.string().optional().describe('Position type (STAKING, LP, LENDING, etc)'),
      platform: z.string().optional().describe('Filter by platform'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.type) filters.type = args.type;
      if (args.platform) filters.platform = args.platform;
      return client.listPositions(args.first, args.after, filters);
    },
  },

  // ===== Organization Balances (2) =====

  {
    name: 'org_balance_list',
    description: 'List organization-level asset balances',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      currency: z.string().optional().describe('Currency for fiat values'),
      platform: z.string().optional().describe('Filter by platform'),
      state: z.string().optional().describe('Balance state filter'),
      exclude_under_delegation: z.boolean().optional().describe('Exclude delegated'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.platform) filters.assetClass_Assets_Platform = args.platform;
      if (args.state) filters.state = args.state;
      if (args.exclude_under_delegation) filters.excludeUnderDelegation = true;
      return client.listOrganizationBalances(args.first, args.currency, filters);
    },
  },

  {
    name: 'asset_balance_list',
    description: 'List detailed asset balances per wallet',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      currency: z.string().optional().describe('Currency for fiat values'),
      platform: z.string().optional().describe('Filter by platform'),
      wallet_id: z.number().optional().describe('Filter by wallet/account ID'),
      asset_symbol: z.string().optional().describe('Search by asset symbol'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.platform) filters.asset_Platform = args.platform;
      if (args.wallet_id) filters.belongsTo_Id = args.wallet_id;
      if (args.asset_symbol) filters.asset_Name_Icontains = args.asset_symbol;
      return client.listAssetBalances(args.first, args.currency, filters);
    },
  },

  // ===== Assets (2) =====

  {
    name: 'asset_list',
    description: 'List tracked assets (tokens, coins) with filters',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      platform: z.string().optional().describe('Filter by platform'),
      symbol: z.string().optional().describe('Filter by symbol'),
      name_contains: z.string().optional().describe('Search by name'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.platform) filters.platform = args.platform;
      if (args.symbol) filters.symbol = args.symbol;
      if (args.name_contains) filters.name_Icontains = args.name_contains;
      return client.listAssets(args.first, filters);
    },
  },

  {
    name: 'asset_class_list',
    description: 'List asset classes (grouped assets by symbol)',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      symbol: z.string().optional().describe('Filter by symbol'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.symbol) filters.symbol = args.symbol;
      return client.listAssetClasses(args.first, filters);
    },
  },

  // ===== Portfolio (3) =====

  {
    name: 'portfolio_daily_networth',
    description: 'Get daily net worth time series for a period',
    inputSchema: z.object({
      currency: z.string().describe('Currency code (e.g. USD)'),
      start_date: z.string().describe('Start date (ISO 8601)'),
      end_date: z.string().describe('End date (ISO 8601)'),
    }),
    handler: async (client, args) => client.getPortfolioDailyNetworth(args.currency, args.start_date, args.end_date),
  },

  {
    name: 'portfolio_by_asset_class',
    description: 'Get daily net worth breakdown by asset class',
    inputSchema: z.object({
      currency: z.string().describe('Currency code'),
      start_date: z.string().describe('Start date (ISO 8601)'),
      end_date: z.string().describe('End date (ISO 8601)'),
    }),
    handler: async (client, args) => client.getPortfolioByAssetClass(args.currency, args.start_date, args.end_date),
  },

  {
    name: 'portfolio_by_balance_state',
    description: 'Get daily net worth breakdown by balance state',
    inputSchema: z.object({
      currency: z.string().describe('Currency code'),
      start_date: z.string().describe('Start date (ISO 8601)'),
      end_date: z.string().describe('End date (ISO 8601)'),
    }),
    handler: async (client, args) => client.getPortfolioByBalanceState(args.currency, args.start_date, args.end_date),
  },

  // ===== Trial Balance (2) =====

  {
    name: 'trial_balance_data',
    description: 'Get trial balance entries with debit/credit',
    inputSchema: z.object({
      balance_date: z.string().optional().describe('Snapshot date (ISO 8601)'),
      start_date: z.string().optional().describe('Period start'),
      end_date: z.string().optional().describe('Period end'),
      account_type: z.string().optional().describe('Filter: asset, liability, equity'),
    }),
    handler: async (client, args) => client.getTrialBalanceData(args.balance_date, args.start_date, args.end_date, args.account_type),
  },

  {
    name: 'trial_balance_summary',
    description: 'Get trial balance summary totals by account type',
    inputSchema: z.object({
      balance_date: z.string().describe('Snapshot date (ISO 8601) — required'),
      start_date: z.string().optional().describe('Period start'),
      end_date: z.string().optional().describe('Period end'),
    }),
    handler: async (client, args) => client.getTrialBalanceSummary(args.balance_date, args.start_date, args.end_date),
  },

  // ===== Staking (3) =====

  {
    name: 'staking_data',
    description: 'Get staking data for a specific validator/wallet',
    inputSchema: z.object({
      platform: z.string().describe('Platform (e.g. ETHEREUM, SOLANA)'),
      identifier: z.string().describe('Wallet/validator address'),
      start: z.string().describe('Start date (ISO 8601)'),
      end: z.string().describe('End date (ISO 8601)'),
      yield_type: z.string().optional().describe('Yield type enum: CONSENSUS_REWARD, MEV_REWARD, DELEGATION_POOL_REWARD, etc.'),
    }),
    handler: async (client, args) => client.getStakingData(args.platform, args.identifier, args.start, args.end, args.yield_type),
  },

  {
    name: 'staking_yield_options',
    description: 'List available staking yield types per platform',
    inputSchema: z.object({}),
    handler: async (client) => client.getStakingYieldOptions(),
  },

  {
    name: 'staking_yield_records',
    description: 'List staking yield records with rates',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      platform: z.string().optional().describe('Filter by platform'),
      yield_type: z.string().optional().describe('Filter by yield type'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.platform) filters.platform = args.platform;
      if (args.yield_type) filters.yieldType = args.yield_type;
      return client.getStakingYieldRecord(args.first, filters);
    },
  },

  // ===== Labels (1) =====

  {
    name: 'label_list',
    description: 'List custom account name labels and tags',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.listLabels(args.first),
  },

  // ===== Reconciliation (2) =====

  {
    name: 'reconciliation_audit',
    description: 'Get reconciliation audit with balance gaps',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      status: z.string().optional().describe('Filter by status'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.status) filters.status = args.status;
      return client.getReconciliationAudit(args.first, filters);
    },
  },

  {
    name: 'reconciliation_gap_fill_rules',
    description: 'List reconciliation gap-fill rules',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.getReconciliationGapFillRules(args.first),
  },

  // ===== Cost Basis (3) =====

  {
    name: 'cost_basis_config',
    description: 'Get cost basis strategy configuration',
    inputSchema: z.object({}),
    handler: async (client) => client.getCostBasisConfig(),
  },

  {
    name: 'cost_basis_ledger',
    description: 'List cost basis ledger entries',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.getCostBasisLedger(args.first),
  },

  {
    name: 'cost_basis_update_strategy',
    description: 'Update cost basis strategy (FIFO, LIFO, AVG, etc)',
    inputSchema: z.object({
      strategy: z.string().describe('Strategy: FIFO, LIFO, AVG, MAX_GAINS, MAX_LOSSES'),
      date: z.string().optional().describe('Effective date (ISO 8601)'),
    }),
    handler: async (client, args) => client.updateCostBasisStrategy(args.strategy, args.date),
  },

  // ===== Integrations (3) =====

  {
    name: 'integration_list',
    description: 'List custodian/exchange integrations',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.listIntegrations(args.first),
  },

  {
    name: 'integration_metadata',
    description: 'Get integration setup metadata and fields',
    inputSchema: z.object({
      integrated_app: z.string().optional().describe('App name (FIREBLOCKS, QUICKBOOKS, etc)'),
    }),
    handler: async (client, args) => client.getIntegrationMetadata(args.integrated_app),
  },

  {
    name: 'integration_sync',
    description: 'Trigger sync for a custodian integration',
    inputSchema: z.object({
      integration_id: z.string().describe('Integration ID to sync'),
    }),
    handler: async (client, args) => client.syncIntegration(args.integration_id),
  },

  // ===== Invoices (1) =====

  {
    name: 'invoice_list',
    description: 'List invoices with status and amounts',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      status: z.string().optional().describe('Filter by status'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.status) filters.status = args.status;
      return client.listInvoices(args.first, filters);
    },
  },

  // ===== Reports (3) =====

  {
    name: 'report_list',
    description: 'List generated reports',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.listReports(args.first),
  },

  {
    name: 'report_query',
    description: 'Fetch report data by ID',
    inputSchema: z.object({
      report_id: z.string().describe('Report ID'),
    }),
    handler: async (client, args) => client.queryReport(args.report_id),
  },

  {
    name: 'report_rerun',
    description: 'Re-execute a report to refresh data',
    inputSchema: z.object({
      report_id: z.string().describe('Report ID to re-run'),
    }),
    handler: async (client, args) => client.rerunReport(args.report_id),
  },

  // ===== Roll Forward (2) =====

  {
    name: 'roll_forward_views',
    description: 'List roll forward views',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.listRollForwardViews(args.first),
  },

  {
    name: 'roll_forward_data',
    description: 'Get roll forward data with balance movements',
    inputSchema: z.object({
      roll_forward_view_id: z.number().optional().describe('View ID to query'),
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.getRollForwardData(args.roll_forward_view_id, args.first),
  },

  // ===== Notifications (2) =====

  {
    name: 'notification_rules_list',
    description: 'List notification/alert rules',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.listNotificationRules(args.first),
  },

  {
    name: 'notification_rule_create',
    description: 'Create a new notification alert rule',
    inputSchema: z.object({
      name: z.string().describe('Rule name'),
      type: z.string().describe('Rule type'),
      conditions: z.any().describe('Rule conditions (JSON)'),
    }),
    handler: async (client, args) => client.createNotificationRule(args.name, args.type, args.conditions),
  },

  // ===== Workflows & Tasks (2) =====

  {
    name: 'workflow_list',
    description: 'List workflows/automations',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.listWorkflows(args.first),
  },

  {
    name: 'ledger_tasks_list',
    description: 'List active ledger processing tasks',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.listLedgerTasks(args.first),
  },

  // ===== Tax Forms (1) =====

  {
    name: 'tax_form_sessions',
    description: 'List tax form sessions (1099, etc)',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.listTaxFormSessions(args.first),
  },

  // ===== Counter-Party (1) =====

  {
    name: 'counter_transfers',
    description: 'List counter-party transfer matching data',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      match_status: z.string().optional().describe('Filter by match status'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.match_status) filters.matchStatus = args.match_status;
      return client.listCounterTransfers(args.first, filters);
    },
  },

  // ===== Pricing / Stateless API (4) =====

  {
    name: 'get_asset_price',
    description: 'Get current/historical price for an asset',
    inputSchema: z.object({
      asset_identifier: z.string().describe('Asset contract address or identifier'),
      platform: z.string().describe('Platform (ETHEREUM, BITCOIN, etc)'),
      currency: z.string().describe('Fiat currency (USD, EUR, etc)'),
      timestamp: z.string().optional().describe('Historical price at timestamp'),
    }),
    handler: async (client, args) => client.getStatelessPricing(args.asset_identifier, args.platform, args.currency, args.timestamp),
  },

  {
    name: 'get_batch_prices',
    description: 'Get prices for multiple assets in one call',
    inputSchema: z.object({
      requests: z.array(z.object({
        assetIdentifier: z.string().describe('Asset identifier'),
        platform: z.string().describe('Platform'),
        currency: z.string().describe('Currency'),
        timestamp: z.string().optional().describe('Historical timestamp'),
      })).describe('Array of pricing requests'),
    }),
    handler: async (client, args) => client.getBatchStatelessPricing(args.requests),
  },

  {
    name: 'supported_platforms',
    description: 'List all supported blockchain platforms (350+)',
    inputSchema: z.object({}),
    handler: async (client) => client.getSupportedPlatforms(),
  },

  {
    name: 'supported_currencies',
    description: 'List all supported fiat currencies',
    inputSchema: z.object({}),
    handler: async (client) => client.getSupportedCurrencies(),
  },

  // ===== Organization (2) =====

  {
    name: 'org_settings',
    description: 'Get organization settings and preferences',
    inputSchema: z.object({}),
    handler: async (client) => client.getOrganizationSettings(),
  },

  {
    name: 'org_settings_update',
    description: 'Update organization settings',
    inputSchema: z.object({
      settings: z.record(z.string(), z.any()).describe('Settings key-value pairs to update'),
    }),
    handler: async (client, args) => client.setOrganizationSettings(args.settings),
  },

  // ===== Audit (1) =====

  {
    name: 'audit_log',
    description: 'View audit log of user actions',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.getAuditLog(args.first),
  },

  // ===== Filter / Utility (3) =====

  {
    name: 'filter_options',
    description: 'Get available filter options (platforms, actions)',
    inputSchema: z.object({}),
    handler: async (client) => client.getFilterOptions(),
  },

  {
    name: 'ledger_filters',
    description: 'Get ledger-specific filter options',
    inputSchema: z.object({}),
    handler: async (client) => client.getLedgerFilters(),
  },

  {
    name: 'favorite_ledger_views',
    description: 'List saved ledger view configurations',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
    }),
    handler: async (client, args) => client.getFavoriteLedgerViews(args.first),
  },

  // ===== Financial Issues (1) =====

  {
    name: 'financial_issues',
    description: 'List financial issues requiring attention',
    inputSchema: z.object({
      first: z.number().optional().describe('Number of results'),
      severity: z.string().optional().describe('Filter by severity'),
    }),
    handler: async (client, args) => {
      const filters: Record<string, any> = {};
      if (args.severity) filters.severity = args.severity;
      return client.getFinancialIssues(args.first, filters);
    },
  },

  // ===== Transaction Mutations (10) =====

  {
    name: 'sub_transaction_edit',
    description: 'Edit a sub-transaction (activity, notes, etc)',
    inputSchema: z.object({
      id: z.string().describe('Sub-transaction ID'),
      financial_action: z.string().optional().describe('New financial action'),
      notes: z.string().optional().describe('Notes/memo'),
    }),
    handler: async (client, args) => {
      const updates: Record<string, any> = {};
      if (args.financial_action) updates.financialAction = args.financial_action;
      if (args.notes) updates.notes = args.notes;
      return client.editSubTransaction(args.id, updates);
    },
  },

  {
    name: 'transaction_bookmark',
    description: 'Bookmark or unbookmark a transaction',
    inputSchema: z.object({
      transaction_id: z.string().describe('Transaction ID'),
      bookmarked: z.boolean().describe('true to bookmark, false to remove'),
    }),
    handler: async (client, args) => client.setTransactionBookmark(args.transaction_id, args.bookmarked),
  },

  {
    name: 'transaction_set_activity',
    description: 'Set custom financial action on a sub-transaction',
    inputSchema: z.object({
      sub_transaction_id: z.string().describe('Sub-transaction ID'),
      financial_action: z.string().describe('Activity type (e.g. staking, lending)'),
    }),
    handler: async (client, args) => client.setCustomActivity(args.sub_transaction_id, args.financial_action),
  },

  {
    name: 'transaction_ignore',
    description: 'Mark a transaction as ignored',
    inputSchema: z.object({
      transaction_id: z.string().describe('Transaction ID to ignore'),
    }),
    handler: async (client, args) => client.ignoreTransaction(args.transaction_id),
  },

  {
    name: 'transaction_unignore',
    description: 'Undo ignoring a transaction',
    inputSchema: z.object({
      transaction_id: z.string().describe('Transaction ID to restore'),
    }),
    handler: async (client, args) => client.undoIgnoreTransaction(args.transaction_id),
  },

  {
    name: 'transaction_mark_internal',
    description: 'Mark sub-transactions as internal transfers',
    inputSchema: z.object({
      sub_transaction_ids: z.array(z.string()).describe('Sub-transaction IDs to mark'),
    }),
    handler: async (client, args) => client.markInternalTransfer(args.sub_transaction_ids),
  },

  {
    name: 'transaction_split',
    description: 'Split a sub-transaction into multiple parts',
    inputSchema: z.object({
      sub_transaction_id: z.string().describe('Sub-transaction ID to split'),
      splits: z.array(z.object({
        amount: z.number().describe('Split amount'),
        financialAction: z.string().optional().describe('Action for this split'),
      })).describe('Split configuration'),
    }),
    handler: async (client, args) => client.splitSubTransaction(args.sub_transaction_id, args.splits),
  },

  {
    name: 'transaction_set_fiat_value',
    description: 'Manually set fiat value for a sub-transaction',
    inputSchema: z.object({
      sub_transaction_id: z.string().describe('Sub-transaction ID'),
      value: z.number().describe('Fiat value'),
      currency: z.string().describe('Currency (USD, EUR, etc)'),
    }),
    handler: async (client, args) => client.setManualFiatValue(args.sub_transaction_id, args.value, args.currency),
  },

  {
    name: 'transaction_comment_add',
    description: 'Add a comment to a transaction',
    inputSchema: z.object({
      transaction_id: z.string().describe('Transaction ID'),
      content: z.string().describe('Comment text'),
    }),
    handler: async (client, args) => client.createTransactionComment(args.transaction_id, args.content),
  },

  {
    name: 'transaction_recalc_fiat',
    description: 'Recalculate fiat values for transactions',
    inputSchema: z.object({
      transaction_ids: z.array(z.string()).describe('Transaction IDs'),
    }),
    handler: async (client, args) => client.calculateBatchFiatValues(args.transaction_ids),
  },

  // ===== Operations Mutations (5) =====

  {
    name: 'trigger_cost_basis',
    description: 'Trigger cost basis calculation engine',
    inputSchema: z.object({}),
    handler: async (client) => client.triggerCostBasis(),
  },

  {
    name: 'trigger_trial_balance',
    description: 'Trigger trial balance recalculation',
    inputSchema: z.object({
      sources: z.array(z.string()).optional().describe('Data sources array (e.g. ["LEDGER"])'),
    }),
    handler: async (client, args) => client.triggerTrialBalance(args.sources),
  },

  {
    name: 'roll_forward_generate',
    description: 'Generate a new roll forward view',
    inputSchema: z.object({
      name: z.string().describe('View name'),
      start_date: z.string().describe('Start date (ISO 8601)'),
      end_date: z.string().describe('End date (ISO 8601)'),
    }),
    handler: async (client, args) => client.generateRollForwardView(args.name, args.start_date, args.end_date),
  },

  {
    name: 'report_sync_external',
    description: 'Sync a report to external ERP system',
    inputSchema: z.object({
      report_id: z.string().describe('Report ID to sync'),
    }),
    handler: async (client, args) => client.syncReportToExternal(args.report_id),
  },

  {
    name: 'healthcheck',
    description: 'Check API health status',
    inputSchema: z.object({}),
    handler: async (client) => client.healthcheck(),
  },

  // ===== AI Agent (2) =====

  {
    name: 'agent_chat_start',
    description: 'Start a new TresAgent AI chat session',
    inputSchema: z.object({
      message: z.string().describe('Initial message to the AI agent'),
    }),
    handler: async (client, args) => client.startTresAgentChat(args.message),
  },

  {
    name: 'agent_chat_send',
    description: 'Send a message in existing TresAgent chat',
    inputSchema: z.object({
      chat_id: z.string().describe('Chat session ID'),
      message: z.string().describe('Message to send'),
    }),
    handler: async (client, args) => client.sendTresAgentMessage(args.chat_id, args.message),
  },

  // ===== Account Management (2) =====

  {
    name: 'wallet_set_name',
    description: 'Set custom display name for a wallet/account',
    inputSchema: z.object({
      internal_account_id: z.string().describe('Internal account ID'),
      name: z.string().describe('New display name'),
    }),
    handler: async (client, args) => client.setCustomAccountName(args.internal_account_id, args.name),
  },

  {
    name: 'user_invite',
    description: 'Invite a new user to the organization',
    inputSchema: z.object({
      email: z.string().describe('User email address'),
      user_type: z.string().optional().describe('User role type'),
    }),
    handler: async (client, args) => client.inviteUser(args.email, args.user_type),
  },

  // =======================================
  // DELTA TOOLS — From Postman Collection
  // =======================================

  // ===== Wallet Mutations (2) =====

  {
    name: 'wallet_create_batch',
    description: 'Create wallets/internal accounts in batch',
    inputSchema: z.object({
      wallets: z.array(z.object({
        parentPlatform: z.string().describe('Platform enum (ETHEREUM, BITCOIN, SOLANA, etc) — unquoted'),
        name: z.string().describe('Display name for the wallet'),
        identifier: z.string().describe('Wallet address or identifier'),
      })).describe('Array of wallet definitions to create'),
    }),
    handler: async (client, args) => client.createBatchWallets(args.wallets),
  },

  {
    name: 'wallet_delete',
    description: 'Delete or clean a wallet/internal account',
    inputSchema: z.object({
      identifier: z.string().describe('Wallet address or identifier'),
      parent_platform: z.string().describe('Platform enum (ETHEREUM, BITCOIN, etc)'),
      delete_internal_account: z.boolean().describe('true to fully delete, false to just clean data'),
    }),
    handler: async (client, args) => client.deleteWallet(args.identifier, args.parent_platform, args.delete_internal_account),
  },

  // ===== Manual Transaction Mutations (6) =====

  {
    name: 'manual_tx_create',
    description: 'Create a manual transaction entry',
    inputSchema: z.object({
      identifier: z.string().describe('Unique transaction identifier'),
      platform: z.string().describe('Platform enum (ETHEREUM, BITCOIN, etc)'),
      timestamp: z.string().describe('Transaction timestamp (ISO 8601)'),
      method_id: z.string().optional().describe('Method/type identifier'),
    }),
    handler: async (client, args) => client.createManualTransactionV2(args.identifier, args.platform, args.timestamp, args.method_id),
  },

  {
    name: 'manual_sub_tx_create',
    description: 'Create a manual sub-transaction within a tx',
    inputSchema: z.object({
      amount: z.number().describe('Transaction amount'),
      platform: z.string().describe('Platform enum (ETHEREUM, etc)'),
      fiat_currency: z.string().describe('Fiat currency (USD, EUR, etc)'),
      fiat_value: z.number().optional().describe('Fiat value override'),
      asset_id: z.string().describe('Asset key (e.g. bitcoin_native)'),
      belongs_to_id: z.string().describe('Internal account ID (wallet)'),
      third_party_identifier: z.string().describe('Counterparty address'),
      transaction_id: z.string().describe('Parent transaction ID'),
      direction: z.string().describe('INFLOW or OUTFLOW'),
      type_id: z.string().describe('Sub-transaction type ID'),
      financial_action: z.string().describe('Financial action (TOKEN_TRANSFER, etc)'),
    }),
    handler: async (client, args) => client.createManualSubTransactionV2({
      amount: args.amount, platform: args.platform, fiatCurrency: args.fiat_currency,
      fiatValue: args.fiat_value, assetId: args.asset_id, belongsToId: args.belongs_to_id,
      thirdPartyIdentifier: args.third_party_identifier, transactionId: args.transaction_id,
      direction: args.direction, typeId: args.type_id, financialAction: args.financial_action,
    }),
  },

  {
    name: 'manual_tx_group_sub',
    description: 'Group sub-transactions under a transaction',
    inputSchema: z.object({
      asset_id: z.string().describe('Asset key'),
      belongs_to_id: z.string().describe('Internal account ID'),
      transaction_id: z.string().describe('Transaction ID to group under'),
    }),
    handler: async (client, args) => client.groupSubTransactions(args.asset_id, args.belongs_to_id, args.transaction_id),
  },

  {
    name: 'manual_tx_undo_split',
    description: 'Undo a previously split sub-transaction',
    inputSchema: z.object({
      sub_tx_id: z.string().describe('Sub-transaction ID to undo split'),
    }),
    handler: async (client, args) => client.undoSplitSubTransaction(args.sub_tx_id),
  },

  {
    name: 'transaction_delete_sub',
    description: 'Delete a sub-transaction by ID',
    inputSchema: z.object({
      id: z.string().describe('Sub-transaction ID'),
    }),
    handler: async (client, args) => client.deleteSubTransaction(args.id),
  },

  {
    name: 'transaction_delete',
    description: 'Delete a transaction by ID',
    inputSchema: z.object({
      id: z.string().describe('Transaction ID'),
    }),
    handler: async (client, args) => client.deleteTransaction(args.id),
  },

  // ===== Commit / Data Collection (7) =====

  {
    name: 'commit_trigger',
    description: 'Trigger data collection commit',
    inputSchema: z.object({
      internal_account_ids: z.array(z.string()).optional().describe('Specific account IDs to commit'),
      from_date: z.string().optional().describe('Start date (ISO 8601 DateTime)'),
      to_date: z.string().optional().describe('End date (ISO 8601 DateTime)'),
      commit_id: z.string().optional().describe('Resume a specific commit by UUID'),
    }),
    handler: async (client, args) => client.triggerCommit(args.internal_account_ids, args.from_date, args.to_date, args.commit_id),
  },

  {
    name: 'commit_trigger_parallel',
    description: 'Trigger parallel data collection commit',
    inputSchema: z.object({
      from_date: z.string().describe('Start date (ISO 8601 DateTime) — required'),
      to_date: z.string().describe('End date (ISO 8601 DateTime) — required'),
      internal_account_ids: z.array(z.string()).optional().describe('Account IDs'),
      internal_account_identifiers: z.array(z.string()).optional().describe('Account addresses'),
      commit_id: z.string().optional().describe('Resume commit UUID'),
      assets_to_collect: z.array(z.string()).optional().describe('Specific asset keys'),
      fetch_full_history: z.boolean().optional().describe('Fetch full history'),
      max_transaction_limit: z.number().optional().describe('Max transactions per account'),
    }),
    handler: async (client, args) => client.triggerParallelCommit({
      fromDate: args.from_date, toDate: args.to_date,
      internalAccountIds: args.internal_account_ids,
      internalAccountIdentifiers: args.internal_account_identifiers,
      commitId: args.commit_id, assetsToCollect: args.assets_to_collect,
      fetchFullHistory: args.fetch_full_history, maxTransactionLimit: args.max_transaction_limit,
    }),
  },

  {
    name: 'commit_check_recon',
    description: 'Check parallel commit reconciliation status',
    inputSchema: z.object({
      commit_id: z.string().describe('Commit UUID to check'),
    }),
    handler: async (client, args) => client.checkParallelCommitRecon(args.commit_id),
  },

  {
    name: 'commit_update_max_tx',
    description: 'Update max transaction limit for a commit',
    inputSchema: z.object({
      commit_id: z.string().describe('Commit UUID'),
      max_transaction_limit: z.number().describe('New max transaction limit'),
    }),
    handler: async (client, args) => client.updateCommitMaxTxLimit(args.commit_id, args.max_transaction_limit),
  },

  {
    name: 'commit_kill',
    description: 'Kill running commits (all or specific IDs)',
    inputSchema: z.object({
      commit_ids: z.array(z.string()).optional().describe('Specific commit IDs to kill (omit for all)'),
    }),
    handler: async (client, args) => client.killCommits(args.commit_ids),
  },

  // ===== Locked Periods (4) =====

  {
    name: 'locked_period_list',
    description: 'List accounting locked period history',
    inputSchema: z.object({}),
    handler: async (client) => client.listLockedPeriods(),
  },

  {
    name: 'locked_period_create',
    description: 'Create a new accounting locked period',
    inputSchema: z.object({
      lock_date: z.string().describe('Lock date (ISO 8601 DateTime)'),
      note: z.string().optional().describe('Optional note/reason'),
    }),
    handler: async (client, args) => client.createLockedPeriod(args.lock_date, args.note),
  },

  {
    name: 'locked_period_update',
    description: 'Update a locked period note',
    inputSchema: z.object({
      locked_period_id: z.number().describe('Locked period integer ID'),
      note: z.string().describe('Updated note text'),
    }),
    handler: async (client, args) => client.updateLockedPeriod(args.locked_period_id, args.note),
  },

  {
    name: 'locked_period_delete',
    description: 'Delete a locked period',
    inputSchema: z.object({
      locked_period_id: z.number().describe('Locked period integer ID'),
    }),
    handler: async (client, args) => client.deleteLockedPeriod(args.locked_period_id),
  },

  // ===== Admin (5) =====

  {
    name: 'admin_page',
    description: 'Get admin page with users and org settings',
    inputSchema: z.object({}),
    handler: async (client) => client.getAdminPage(),
  },

  {
    name: 'admin_delete_user',
    description: 'Delete a user from the organization',
    inputSchema: z.object({
      user_id: z.string().describe('Auth0 user ID (e.g. auth0|xxx)'),
    }),
    handler: async (client, args) => client.deleteUser(args.user_id),
  },

  {
    name: 'admin_set_user_type',
    description: 'Set user role/type in the organization',
    inputSchema: z.object({
      user_id: z.string().describe('Auth0 user ID'),
      user_type: z.string().describe('UserType enum: ADMIN, VIEWER, EDITOR'),
    }),
    handler: async (client, args) => client.setUserType(args.user_id, args.user_type),
  },

  {
    name: 'admin_set_platform_collection',
    description: 'Enable/disable data collection per platform',
    inputSchema: z.object({
      statuses: z.array(z.object({
        platform: z.string().describe('Platform enum (BITCOIN, ETHEREUM, etc)'),
        enabled: z.boolean().describe('true to enable, false to disable'),
      })).describe('Platform collection statuses to set'),
    }),
    handler: async (client, args) => client.setPlatformCollectionStatus(args.statuses),
  },

  {
    name: 'notification_rule_delete',
    description: 'Delete a notification alert rule',
    inputSchema: z.object({
      rule_id: z.string().describe('Notification rule ID'),
    }),
    handler: async (client, args) => client.deleteNotificationRule(args.rule_id),
  },

  // ===== Classification Rules (3) =====

  {
    name: 'classification_rule_create',
    description: 'Create transaction classification rule',
    inputSchema: z.object({
      activity: z.string().describe('Activity/classification name'),
      parent_platform: z.string().optional().describe('Platform enum (ETHEREUM, etc)'),
      method_id: z.string().optional().describe('Method ID filter'),
      recipient_identifier: z.string().optional().describe('Recipient address filter'),
      sender_identifier: z.string().optional().describe('Sender address filter'),
      priority: z.number().optional().describe('Rule priority (0 = highest)'),
      sender_internal_account_tag: z.string().optional().describe('Sender wallet tag'),
      recipient_internal_account_tag: z.string().optional().describe('Recipient wallet tag'),
      sender_contact_tag: z.string().optional().describe('Sender contact tag'),
      recipient_contact_tag: z.string().optional().describe('Recipient contact tag'),
    }),
    handler: async (client, args) => client.createClassificationRule({
      activity: args.activity, parentPlatform: args.parent_platform,
      methodId: args.method_id, recipientIdentifier: args.recipient_identifier,
      senderIdentifier: args.sender_identifier, priority: args.priority,
      senderInternalAccountTag: args.sender_internal_account_tag,
      recipientInternalAccountTag: args.recipient_internal_account_tag,
      senderContactTag: args.sender_contact_tag, recipientContactTag: args.recipient_contact_tag,
    }),
  },

  {
    name: 'classification_rule_update',
    description: 'Update a transaction classification rule',
    inputSchema: z.object({
      id: z.string().describe('Rule ID'),
      activity: z.string().describe('New activity/classification'),
      priority: z.number().optional().describe('New priority'),
    }),
    handler: async (client, args) => client.updateClassificationRule(args.id, args.activity, args.priority),
  },

  {
    name: 'classification_rule_delete',
    description: 'Delete a transaction classification rule',
    inputSchema: z.object({
      key: z.string().describe('Rule key string'),
    }),
    handler: async (client, args) => client.deleteClassificationRule(args.key),
  },

  // ===== Reconciliation Writes (3) =====

  {
    name: 'recon_create_gap_fill_rule',
    description: 'Create a reconciliation gap-fill rule',
    inputSchema: z.object({
      internal_account_id: z.number().describe('Internal account ID (integer)'),
      asset_id: z.string().describe('Asset key (e.g. ethereum_native)'),
      interval: z.string().describe('Interval enum (DAILY, HOURLY, etc)'),
      name: z.string().describe('Rule name'),
    }),
    handler: async (client, args) => client.createGapFillRule(args.internal_account_id, args.asset_id, args.interval, args.name),
  },

  {
    name: 'recon_delete_gap_fill_rules',
    description: 'Delete reconciliation gap-fill rules by IDs',
    inputSchema: z.object({
      rule_ids: z.array(z.string()).describe('Rule IDs to delete'),
    }),
    handler: async (client, args) => client.deleteGapFillRules(args.rule_ids),
  },

  {
    name: 'recon_create_from_fillers',
    description: 'Create manual sub-transactions from gap fillers',
    inputSchema: z.object({
      internal_account_id: z.number().describe('Internal account ID'),
      asset: z.string().describe('Asset key'),
      method_id: z.string().optional().describe('Method ID'),
      filler_ids: z.array(z.string()).optional().describe('Specific filler IDs'),
    }),
    handler: async (client, args) => client.createManualSubFromFillers(args.internal_account_id, args.asset, args.method_id, args.filler_ids),
  },

  // ===== Address Book (7) =====

  {
    name: 'addressbook_search',
    description: 'Search address book (custom account labels)',
    inputSchema: z.object({
      search: z.string().optional().describe('Search term (address or label)'),
      limit: z.number().optional().describe('Max results'),
      offset: z.number().optional().describe('Pagination offset'),
    }),
    handler: async (client, args) => client.searchAddressBook(args.search, args.limit, args.offset),
  },

  {
    name: 'addressbook_identified',
    description: 'List identified counterparty accounts',
    inputSchema: z.object({
      limit: z.number().optional().describe('Max results'),
      offset: z.number().optional().describe('Pagination offset'),
      fiat_currency: z.string().optional().describe('Currency for fiat values'),
    }),
    handler: async (client, args) => client.getIdentifiedAccounts(args.limit, args.offset, args.fiat_currency),
  },

  {
    name: 'addressbook_unidentified',
    description: 'List unidentified counterparty addresses',
    inputSchema: z.object({
      limit: z.number().optional().describe('Max results'),
      offset: z.number().optional().describe('Pagination offset'),
      fiat_currency: z.string().optional().describe('Currency for fiat values'),
      account_direction: z.string().optional().describe('Filter: sender or recipient'),
    }),
    handler: async (client, args) => client.getUnidentifiedAddresses(args.limit, args.offset, args.fiat_currency, args.account_direction),
  },

  {
    name: 'addressbook_tags',
    description: 'Get available address book tag options',
    inputSchema: z.object({}),
    handler: async (client) => client.getAddressBookTags(),
  },

  {
    name: 'addressbook_set_name',
    description: 'Set a custom label on a counterparty address',
    inputSchema: z.object({
      identifier: z.string().describe('Counterparty address'),
      label_value: z.string().describe('Custom label/name'),
    }),
    handler: async (client, args) => client.setAddressBookName(args.identifier, args.label_value),
  },

  {
    name: 'addressbook_set_tags',
    description: 'Set tags on a counterparty address label',
    inputSchema: z.object({
      identifier: z.string().describe('Counterparty address'),
      tags: z.array(z.string()).describe('Tags to assign'),
    }),
    handler: async (client, args) => client.setAddressBookTags(args.identifier, args.tags),
  },

  {
    name: 'addressbook_delete_name',
    description: 'Delete a custom label from counterparty address',
    inputSchema: z.object({
      identifier: z.string().describe('Counterparty address'),
      label_value: z.string().describe('Label value to delete'),
    }),
    handler: async (client, args) => client.deleteAddressBookName(args.identifier, args.label_value),
  },

  // ===== Recurring Reports (3) =====

  {
    name: 'recurring_report_list',
    description: 'List scheduled recurring reports',
    inputSchema: z.object({}),
    handler: async (client) => client.listRecurringReports(),
  },

  {
    name: 'recurring_report_create',
    description: 'Create a scheduled recurring report',
    inputSchema: z.object({
      export_type: z.string().describe('Report type enum (RAW_BALANCES, etc)'),
      name: z.string().describe('Report name'),
      enable: z.boolean().optional().describe('Enable immediately (default true)'),
      when: z.object({
        interval: z.number().nullable().optional().describe('Interval in seconds'),
        year: z.string().nullable().optional().describe('Year pattern (* for all)'),
        month: z.string().nullable().optional().describe('Month pattern'),
        dayOfMonth: z.string().nullable().optional().describe('Day of month'),
        dayOfWeek: z.string().nullable().optional().describe('Day of week'),
        hour: z.string().nullable().optional().describe('Hour'),
      }).describe('Schedule configuration'),
    }),
    handler: async (client, args) => client.createRecurringReport({
      exportType: args.export_type, name: args.name, enable: args.enable, when: args.when,
    }),
  },

  {
    name: 'recurring_report_delete',
    description: 'Delete a recurring report',
    inputSchema: z.object({
      id: z.string().describe('Recurring report ID'),
    }),
    handler: async (client, args) => client.deleteRecurringReport(args.id),
  },

  // ===== Report Types & Sync (2) =====

  {
    name: 'available_report_types',
    description: 'List all available report generation types',
    inputSchema: z.object({}),
    handler: async (client) => client.getAvailableReportTypes(),
  },

  {
    name: 'report_sync_snowflake',
    description: 'Sync a report to Snowflake or external resource',
    inputSchema: z.object({
      id: z.number().describe('Report ID (integer)'),
      resource: z.string().describe('Target resource (SNOWFLAKE, etc)'),
    }),
    handler: async (client, args) => client.syncReportToExternalV2(args.id, args.resource),
  },

  // ===== Transaction Restore (2) =====

  {
    name: 'transaction_restore',
    description: 'Restore a deleted transaction',
    inputSchema: z.object({
      transaction_id: z.string().describe('Transaction ID to restore'),
    }),
    handler: async (client, args) => client.restoreTransaction(args.transaction_id),
  },

  {
    name: 'sub_transaction_restore',
    description: 'Restore a deleted sub-transaction',
    inputSchema: z.object({
      sub_transaction_id: z.string().describe('Sub-transaction ID to restore'),
    }),
    handler: async (client, args) => client.restoreSubTransaction(args.sub_transaction_id),
  },
];
