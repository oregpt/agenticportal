/**
 * Tres Finance GraphQL API Client
 *
 * Auth: OAuth2 Client Credentials → getApiKey mutation → JWT Bearer (10-day expiry)
 * Auth endpoint: https://api.prod.tres.finance/graphql
 * Data endpoint: https://api.tres.finance/graphql
 *
 * Schema notes (validated via introspection 2026-02-14):
 * - PageInfoExtra has: hasNextPage, hasPreviousPage, totalCount (NO endCursor)
 * - Currency and Platform are enums — do NOT quote them (use USD not "USD")
 * - DateTime fields expect ISO 8601 with time: "2024-01-01T00:00:00Z"
 * - Date fields expect: "2024-01-01"
 * - healthcheck is a root query returning a String, not a mutation
 * - financialIssue (singular), reconciliationGapFillRule (singular)
 * - getCostBasisStrategyByDate replaces costBasisInventoryConfiguration
 * - getSupportedStatelessApi replaces supportedPlatforms/supportedCurrencies
 * - organizationDetails replaces organizationSettings
 * - getStatelessPricing uses: platform (enum), currencies (enum array)
 */

const DEFAULT_AUTH_ENDPOINT = 'https://api.prod.tres.finance/graphql';
const DEFAULT_DATA_ENDPOINT = 'https://api.tres.finance/graphql';

export class TresFinanceClient {
  private clientId: string;
  private clientSecret: string;
  private authEndpoint: string;
  private dataEndpoint: string;
  private orgName?: string;
  private token: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId: string, clientSecret: string, authEndpoint?: string, dataEndpoint?: string, orgName?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.authEndpoint = authEndpoint || DEFAULT_AUTH_ENDPOINT;
    this.dataEndpoint = dataEndpoint || DEFAULT_DATA_ENDPOINT;
    this.orgName = orgName;
  }

  private async authenticate(): Promise<void> {
    const gql = `mutation { getApiKey(clientId: "${this.clientId}", clientSecret: "${this.clientSecret}") { token } }`;
    const response = await fetch(this.authEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql }),
    });

    if (!response.ok) {
      throw new Error(`Auth failed: HTTP ${response.status}`);
    }

    const json = await response.json() as any;
    if (json.errors?.length) {
      throw new Error(`Auth error: ${json.errors.map((e: any) => e.message).join('; ')}`);
    }

    // API returns { getApiKey: { token: { access_token: "..." } } } or { getApiKey: "jwt" }
    const apiKeyResult = json.data?.getApiKey;
    if (typeof apiKeyResult === 'string') {
      this.token = apiKeyResult;
    } else if (apiKeyResult?.token?.access_token) {
      this.token = apiKeyResult.token.access_token;
    } else if (apiKeyResult?.token) {
      this.token = typeof apiKeyResult.token === 'string' ? apiKeyResult.token : null;
    } else {
      this.token = null;
    }

    if (!this.token) {
      throw new Error('Auth failed: no token returned');
    }

    // JWT tokens from Tres expire in ~10 days; re-auth after 9 days
    this.tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
  }

  private async ensureAuth(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      await this.authenticate();
    }
    return this.token!;
  }

  async query<T = any>(gql: string, variables?: Record<string, any>): Promise<T> {
    const token = await this.ensureAuth();
    const body: any = { query: gql };
    if (variables && Object.keys(variables).length > 0) {
      body.variables = variables;
    }

    const response = await fetch(this.dataEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(this.orgName ? { 'x-org-name': this.orgName } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Error ${response.status}: ${text.substring(0, 500)}`);
    }

    const json = await response.json() as any;
    if (json.errors?.length) {
      throw new Error(`GraphQL Error: ${json.errors.map((e: any) => e.message).join('; ')}`);
    }

    return json.data as T;
  }

  async mutate<T = any>(gql: string, variables?: Record<string, any>): Promise<T> {
    return this.query<T>(gql, variables);
  }

  // ===== Overview & Dashboard =====

  async getOverviewNetWorth(currency?: string) {
    // currency is an enum, no quotes
    const currArg = currency ? `(currency: ${currency})` : '';
    return this.query(`{ overviewQuery { netWorthWidget${currArg} } }`);
  }

  async getOverviewNetworkExposure(currency?: string) {
    const currArg = currency ? `(currency: "${currency}")` : '';
    return this.query(`{ overviewQuery { networkExposureWidget${currArg} } }`);
  }

  async getOverviewDailyInflowOutflow(startDate: string, endDate: string, currency?: string) {
    // startDate/endDate are DateTime — need ISO with time; currency is required
    const args = [`startDate: "${startDate}T00:00:00Z"`, `endDate: "${endDate}T23:59:59Z"`, `currency: "${currency || 'USD'}"`];
    return this.query(`{ overviewQuery { dailyInflowOutflowWidget(${args.join(', ')}) } }`);
  }

  async getOverviewUnderlyingAssets(currency?: string) {
    const currArg = currency ? `(currency: "${currency}")` : '';
    return this.query(`{ overviewQuery { underlyingAssetsWidget${currArg} } }`);
  }

  async getOverviewApplicationSummary(currency?: string, platforms?: string[]) {
    const args: string[] = [];
    if (currency) args.push(`currency: "${currency}"`);
    if (platforms?.length) args.push(`platform_In: [${platforms.map(p => `"${p}"`).join(', ')}]`);
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.query(`{ overviewQuery { applicationSummaryWidget${argStr} { application platform totalFiatValue totalPositionsCount } } }`);
  }

  async getOverviewFull(currency?: string) {
    const cEnum = currency || 'USD';
    const cStr = currency ? `"${currency}"` : '"USD"';
    return this.query(`{ overviewQuery {
      netWorthWidget(currency: ${cEnum})
      networkExposureWidget(currency: ${cStr})
      underlyingAssetsWidget(currency: ${cStr})
      applicationSummaryWidget(currency: ${cStr}) { application platform totalFiatValue totalPositionsCount }
    } }`);
  }

  // ===== Transactions =====

  async listTransactions(first?: number, after?: string, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (after) args.push(`after: "${after}"`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else if (Array.isArray(v)) args.push(`${k}: [${v.map(i => typeof i === 'string' ? `"${i}"` : i).join(', ')}]`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // TransactionQuery fields: id, identifier, timestamp, platform, success, classification, blockNumber, etc.
    // No 'hash', 'direction', 'status' at transaction level
    return this.query(`{ transaction${argStr} {
      totalCount
      results {
        id identifier timestamp platform success blockNumber
      }
    } }`);
  }

  async getTransactionSummary(first?: number) {
    // accountTxsSummary — fiatCurrency filter doesn't work reliably (server-side enum mismatch)
    // Just query without fiatCurrency filter; results include their own fiatCurrency field
    const argStr = first ? `(first: ${first})` : '(first: 5)';
    return this.query(`{ accountTxsSummary${argStr} {
      results {
        id accountIdentifier displayName
        inflowFiatValue inflowTxCount outflowFiatValue outflowTxCount
      }
    } }`);
  }

  async listSubTransactions(first?: number, after?: string, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (after) args.push(`after: "${after}"`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else if (Array.isArray(v)) args.push(`${k}: [${v.map(i => typeof i === 'string' ? `"${i}"` : i).join(', ')}]`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // SubTransactionQuery fields: id, amount, platform, timestamp, balanceFactor, partition, etc.
    // No 'direction', 'financialAction' directly — use balanceFactor, partition
    return this.query(`{ subTransaction${argStr} {
      totalCount
      results {
        id amount platform timestamp balanceFactor
      }
    } }`);
  }

  // ===== Wallets & Internal Accounts =====

  async listWallets(first?: number, after?: string, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (after) args.push(`after: "${after}"`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else if (Array.isArray(v)) args.push(`${k}: [${v.map(i => typeof i === 'string' ? `"${i}"` : i).join(', ')}]`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // InternalAccountQuery: id, name, identifier, status, parentPlatform, platforms, tags, displayName
    // No 'platform' (singular) — use parentPlatform or platforms
    return this.query(`{ internalAccount${argStr} {
      totalCount
      results {
        id name identifier parentPlatform status displayName
        tags
      }
    } }`);
  }

  // ===== Positions =====

  async listPositions(first?: number, after?: string, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (after) args.push(`after: "${after}"`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else if (Array.isArray(v)) args.push(`${k}: [${v.map(i => typeof i === 'string' ? `"${i}"` : i).join(', ')}]`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // PositionQuery: id, type, displayName, application, platform, identifier, etc. No 'protocol'
    return this.query(`{ position${argStr} {
      totalCount
      results { id type platform application displayName identifier }
    } }`);
  }

  // ===== Organization Balance =====

  async listOrganizationBalances(first?: number, currency?: string, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (currency) args.push(`currency: "${currency}"`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else if (Array.isArray(v)) args.push(`${k}: [${v.map(i => typeof i === 'string' ? `"${i}"` : i).join(', ')}]`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // NOTE: pageInfo can return null for non-paginated org balance; keep query minimal
    return this.query(`{ organizationBalance${argStr} {
      totalCount
      results {
        id name amount state status
        assetClass { id symbol verificationStatus }
      }
    } }`);
  }

  // ===== Asset Balance =====

  async listAssetBalances(first?: number, currency?: string, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (currency) args.push(`currency: "${currency}"`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else if (Array.isArray(v)) args.push(`${k}: [${v.map(i => typeof i === 'string' ? `"${i}"` : i).join(', ')}]`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // PageInfoExtra: hasNextPage, totalCount (no endCursor)
    return this.query(`{ assetBalance${argStr} {
      totalCount
      results {
        id name state amount
        asset { identifier platform symbol }
        belongsTo { identifier name }
      }
    } }`);
  }

  // ===== Assets =====

  async listAssets(first?: number, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else if (Array.isArray(v)) args.push(`${k}: [${v.map(i => typeof i === 'string' ? `"${i}"` : i).join(', ')}]`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // AssetQuery: key, identifier, platform, symbol, name, type, decimals — NO 'id'
    return this.query(`{ asset${argStr} {
      totalCount
      results { key identifier platform symbol name type }
    } }`);
  }

  async listAssetClasses(first?: number, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else if (Array.isArray(v)) args.push(`${k}: [${v.map(i => typeof i === 'string' ? `"${i}"` : i).join(', ')}]`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.query(`{ assetClass${argStr} {
      totalCount
      results { id name symbol verificationStatus }
    } }`);
  }

  // ===== Portfolio =====

  async getPortfolioDailyNetworth(currency: string, startDate: string, endDate: string) {
    // currency is an enum — no quotes; 'limit' is NOT a valid argument
    // returns [DailyNetworthObjectType] needing subfields
    const args = [`currency: ${currency}`, `startDate: "${startDate}"`, `endDate: "${endDate}"`];
    return this.query(`{ portfolio { dailyNetworth(${args.join(', ')}) { date totalValue totalAmount unitPrice } } }`);
  }

  async getPortfolioByAssetClass(currency: string, startDate: string, endDate: string) {
    return this.query(`{ portfolio { dailyNetworthPerAssetClass(currency: ${currency}, startDate: "${startDate}", endDate: "${endDate}") { date totalValue } } }`);
  }

  async getPortfolioByBalanceState(currency: string, startDate: string, endDate: string) {
    return this.query(`{ portfolio { dailyNetworthPerBalanceState(currency: ${currency}, startDate: "${startDate}", endDate: "${endDate}") { date totalValue } } }`);
  }

  // ===== Trial Balance =====

  async getTrialBalanceData(balanceDate?: string, startDate?: string, endDate?: string, accountType?: string) {
    const args: string[] = [];
    // DateTime fields need ISO with time component
    if (balanceDate) args.push(`balanceDate: "${balanceDate.includes('T') ? balanceDate : balanceDate + 'T00:00:00Z'}"`);
    if (startDate) args.push(`startDate: "${startDate.includes('T') ? startDate : startDate + 'T00:00:00Z'}"`);
    if (endDate) args.push(`endDate: "${endDate.includes('T') ? endDate : endDate + 'T23:59:59Z'}"`);
    if (accountType) args.push(`accountType: "${accountType}"`);
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.query(`{ trialBalanceData${argStr} { success } }`);
  }

  async getTrialBalanceSummary(balanceDate?: string, startDate?: string, endDate?: string) {
    const args: string[] = [];
    if (balanceDate) args.push(`balanceDate: "${balanceDate.includes('T') ? balanceDate : balanceDate + 'T00:00:00Z'}"`);
    if (startDate) args.push(`startDate: "${startDate.includes('T') ? startDate : startDate + 'T00:00:00Z'}"`);
    if (endDate) args.push(`endDate: "${endDate.includes('T') ? endDate : endDate + 'T23:59:59Z'}"`);
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.query(`{ trialBalanceSummary${argStr} { success } }`);
  }

  // ===== Staking =====

  async getStakingData(platform: string, identifier: string, start: string, end: string, yieldType?: string) {
    // platform is an enum (no quotes), start/end are Date type (use YYYY-MM-DD)
    // yieldType is optional StakingYieldType enum (CONSENSUS_REWARD, MEV_REWARD, etc.)
    const args = [`platform: ${platform}`, `identifier: "${identifier}"`, `start: "${start}"`, `end: "${end}"`];
    if (yieldType) args.push(`yieldType: ${yieldType}`);
    return this.query(`{ stakingData(${args.join(', ')}) {
      identifier start end platform
    } }`);
  }

  async getStakingYieldOptions() {
    // Fields: platform, yieldType (singular), assetOptions
    return this.query(`{ stakingYieldOptions { platform yieldType } }`);
  }

  async getStakingYieldRecord(first?: number, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // StakingYieldRecordQuery: id, yieldType, startDate, endDate, platform, generatedRewards, apr, etc.
    // No 'amount' or 'annualRate'
    return this.query(`{ stakingYieldRecord${argStr} {
      totalCount
      results { id yieldType startDate endDate platform generatedRewards apr }
    } }`);
  }

  // ===== Labels & Accounts =====

  async listLabels(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    // CustomAccountNameLabelQuery: id, labelValue, identifier, platform, tags (scalar), etc.
    // No 'name' field — use labelValue. 'tags' is a scalar, not an object
    return this.query(`{ customAccountNameLabel${argStr} {
      totalCount
      results { id labelValue identifier tags }
    } }`);
  }

  // ===== Reconciliation =====

  async getReconciliationAudit(first?: number, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // CollectAuditQuery: commitId, status, progress, createdAt, commitType, etc. NO 'id', 'groupTime', 'balance', 'gap'
    return this.query(`{ collectAudit${argStr} {
      totalCount
      results { commitId status progress createdAt commitType }
    } }`);
  }

  async getReconciliationGapFillRules(first?: number) {
    // Correct field name: reconciliationGapFillRule (singular)
    const argStr = first ? `(first: ${first})` : '';
    return this.query(`{ reconciliationGapFillRule${argStr} {
      totalCount
      results { id name interval startDate endDate status }
    } }`);
  }

  // ===== Cost Basis =====

  async getCostBasisConfig() {
    // getCostBasisStrategyByDate → response → { defaultStrategy, strategyPeriods }
    // Known issue: server may crash if org strategy is AVG (not in CostBasisStackBasedStrategy enum)
    // Try the full query; if it fails with enum error, return a graceful fallback
    try {
      return await this.query(`{ getCostBasisStrategyByDate { response { strategyPeriods { startDate endDate strategy } } } }`);
    } catch (err: any) {
      if (err.message?.includes('CostBasisStackBasedStrategy')) {
        // Server-side enum mismatch — return what we know
        return { getCostBasisStrategyByDate: { note: 'Server-side enum mismatch: org strategy not in allowed enum values' } };
      }
      throw err;
    }
  }

  async getCostBasisLedger(first?: number, filters?: Record<string, any>) {
    // costBasisLedger doesn't exist; use costBasisSpecIdRule as closest alternative
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.query(`{ costBasisSpecIdRule${argStr} {
      totalCount
      results { id }
    } }`);
  }

  // ===== Integrations =====

  async listIntegrations(first?: number) {
    // Use 'integration' query (not custodianIntegrations which requires integratedApp String!)
    // Do NOT request 'integratedApp' field — it's an enum that can contain empty strings
    // causing "Enum 'SchemaIntegrationIntegratedAppChoices' cannot represent value: ''" error
    const argStr = first ? `(first: ${first})` : '';
    return this.query(`{ integration${argStr} {
      totalCount
      results { id }
    } }`);
  }

  async getIntegrationMetadata(integratedApp?: string) {
    // exchangeRequiredFields.requiredFields needs exchangeName arg (String!)
    // custodianIntegrationMetadata.dataTypes needs custodianName arg (String!)
    // Return the list of integrations with their IDs as metadata
    if (integratedApp) {
      return this.query(`{ exchangeRequiredFields { requiredFields(exchangeName: "${integratedApp}") { name type description } } }`);
    }
    // Without a specific app, return the list of available integrations
    return this.query(`{ integration(first: 50) { totalCount results { id } } }`);
  }

  async getIntegrationInsights(integratedApp?: string) {
    const argStr = integratedApp ? `(integratedApp: "${integratedApp}")` : '';
    return this.query(`{ custodianInsights${argStr} { counterTransfersStatus } }`);
  }

  // ===== Invoices =====

  async listInvoices(first?: number, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.query(`{ invoice${argStr} {
      totalCount
      results { id source status direction invoiceId invoiceType }
    } }`);
  }

  // ===== Reports =====

  async listReports(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    // ReportQuery: id, name, status, reportType, createdAt, exportFormat, currency — No 'type', 'updatedAt'
    return this.query(`{ report${argStr} {
      totalCount
      results { id name status reportType createdAt exportFormat }
    } }`);
  }

  // ===== Roll Forward =====

  async listRollForwardViews(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    return this.query(`{ rollForwardView${argStr} {
      totalCount
      results { id name startDate endDate status lastSyncAt numberOfAssets numberOfWallets }
    } }`);
  }

  async getRollForwardData(rollForwardViewId?: number, first?: number) {
    const args: string[] = [];
    if (rollForwardViewId) args.push(`rollForwardViewId: ${rollForwardViewId}`);
    if (first) args.push(`first: ${first}`);
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.query(`{ rollForwardData${argStr} {
      totalCount
      results { id status rollForwardViewDataType openRunningBalance closeRunningBalance inflow outflow fees realizedGains }
    } }`);
  }

  // ===== Notifications =====

  async listNotificationRules(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    // NotificationRuleQuery: id, rule, threshold, enable, side, currency, priority — No 'name', 'type', 'status', 'conditions'
    return this.query(`{ notificationRule${argStr} {
      totalCount
      results { id rule threshold enable side priority }
    } }`);
  }

  // ===== Workflows =====

  async listWorkflows(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    // WorkflowQuery: id, name, type, status, createdAt, etc.
    return this.query(`{ workflow${argStr} {
      totalCount
      results { id name type status }
    } }`);
  }

  // ===== Ledger Tasks =====

  async listLedgerTasks(first?: number) {
    // ledgerTasks takes NO args; listWorkflows returns [LedgerTasks] needing subfields
    return this.query(`{ ledgerTasks { listWorkflows { status } } }`);
  }

  // ===== Tax Forms =====

  async listTaxFormSessions(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    // TaxFormSessionQuery: id, taxYear, formType, isCompleted, currentStep, createdAt — No 'name', 'status', 'type', 'year'
    return this.query(`{ taxFormSession${argStr} {
      totalCount
      results { id taxYear formType isCompleted currentStep }
    } }`);
  }

  async listTaxFormReports(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    return this.query(`{ taxFormReport${argStr} {
      totalCount
      results { id status }
      pageInfo { hasNextPage totalCount }
    } }`);
  }

  // ===== Counter-Party =====

  async listCounterTransfers(first?: number, filters?: Record<string, any>) {
    // counterOrganizations returns [CounterOrganizationQuery] needing subfields: id, name, displayName
    return this.query(`{ counterOrganizations { id name displayName } }`);
  }

  // ===== Stateless API (Pricing) =====

  async getStatelessPricing(assetIdentifier: string, platform: string, currency: string, timestamp?: string) {
    // platform is an enum (no quotes), currencies is an enum array (no quotes)
    const args = [`assetIdentifier: "${assetIdentifier}"`, `platform: ${platform}`, `currencies: [${currency}]`];
    if (timestamp) args.push(`timestamp: "${timestamp}"`);
    return this.query(`{ getStatelessPricing(${args.join(', ')}) { prices } }`);
  }

  async getBatchStatelessPricing(requests: Array<{ assetIdentifier: string; platform: string; currency: string; timestamp?: string }>) {
    // Build inline requests since the variable type name may differ
    const reqParts = requests.map(r => {
      const parts = [`assetIdentifier: "${r.assetIdentifier}"`, `platform: ${r.platform}`, `currencies: [${r.currency}]`];
      if (r.timestamp) parts.push(`timestamp: "${r.timestamp}"`);
      return `{ ${parts.join(', ')} }`;
    });
    return this.query(`{ getBatchStatelessPricing(requests: [${reqParts.join(', ')}]) { prices } }`);
  }

  async getSupportedPlatforms() {
    // supportedPlatforms doesn't exist; use getSupportedStatelessApi
    // applications is [SupportedApplicationObjectType]! needing subfields; balances is [Platform]! (enum array, no subfields)
    return this.query(`{ getSupportedStatelessApi { applications { name platforms } balances } }`);
  }

  async getSupportedCurrencies() {
    // supportedCurrencies doesn't exist; use getSupportedStatelessApi
    return this.query(`{ getSupportedStatelessApi { applications { name platforms } balances } }`);
  }

  // ===== Organization =====

  async getOrganizationSettings() {
    // organizationSettings doesn't exist; use organizationDetails
    return this.query(`{ organizationDetails { results { id } } }`);
  }

  async setOrganizationSettings(settings: Record<string, any>) {
    return this.mutate(`mutation($settings: GenericScalar!) { setOrganizationSettings(settings: $settings) { success } }`, { settings });
  }

  // ===== Audit =====

  async getAuditLog(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    // LogEntryQuery: id, action, timestamp, operationName, endpoint — 'actor' is UserQuery (needs subfields), no 'user', 'details'
    return this.query(`{ auditLog${argStr} {
      totalCount
      results { id action timestamp }
    } }`);
  }

  // ===== Filter/Utility =====

  async getFilterOptions() {
    // filterOptions.platforms is [FilterQueryType] with fields: id, displayName
    // No 'financialActions' on filterOptions — that's on ledgerFilters
    return this.query(`{ filterOptions { platforms { id displayName } } }`);
  }

  async getLedgerFilters() {
    // ledgerFilters.platforms is [FilterQueryType] with fields: id, displayName
    return this.query(`{ ledgerFilters { platforms { id displayName } } }`);
  }

  async getFavoriteLedgerViews(first?: number) {
    const argStr = first ? `(first: ${first})` : '';
    // FavoriteLedgerViewQuery: id, name, variables, queryParams — No 'filters'
    return this.query(`{ favoriteLedgerView${argStr} {
      totalCount
      results { id name variables queryParams }
    } }`);
  }

  // ===== Financial Issues =====

  async getFinancialIssues(first?: number, filters?: Record<string, any>) {
    const args: string[] = [];
    if (first) args.push(`first: ${first}`);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v === 'string') args.push(`${k}: "${v}"`);
        else args.push(`${k}: ${v}`);
      }
    }
    const argStr = args.length ? `(${args.join(', ')})` : '';
    // financialIssue (singular, not financialIssues)
    // Fields: id, type, severity, message — No 'description', 'status'
    return this.query(`{ financialIssue${argStr} {
      totalCount
      results { id type severity message }
    } }`);
  }

  // ===== MUTATIONS =====

  async healthcheck() {
    // healthcheck is a root QUERY returning a String (not a mutation)
    return this.query(`{ healthcheck }`);
  }

  async classifyTransactions(transactionIds: string[]) {
    return this.mutate(`mutation($ids: [ID]!) { classifyBatchTransactions(transactionsIds: $ids) { success } }`, { ids: transactionIds });
  }

  async editSubTransaction(id: string, updates: Record<string, any>) {
    const vars: any = { id, ...updates };
    const argDefs: string[] = ['$id: ID!'];
    const argUses: string[] = ['id: $id'];
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v === 'string') { argDefs.push(`$${k}: String`); argUses.push(`${k}: $${k}`); }
      else if (typeof v === 'number') { argDefs.push(`$${k}: Float`); argUses.push(`${k}: $${k}`); }
      else if (typeof v === 'boolean') { argDefs.push(`$${k}: Boolean`); argUses.push(`${k}: $${k}`); }
    }
    return this.mutate(`mutation(${argDefs.join(', ')}) { editSubTransaction(${argUses.join(', ')}) { success } }`, vars);
  }

  async createManualTransaction(input: Record<string, any>) {
    return this.mutate(`mutation($input: ManualTransactionInput!) { createOrUpdateManualTransaction(input: $input) { success transaction { id } } }`, { input });
  }

  async setTransactionBookmark(transactionId: string, bookmarked: boolean) {
    return this.mutate(`mutation { setTransactionBookmark(transactionId: "${transactionId}", bookmarked: ${bookmarked}) { success } }`);
  }

  async setBatchTransactionBookmark(transactionIds: string[], bookmarked: boolean) {
    return this.mutate(`mutation($ids: [ID]!) { setBatchTransactionBookmark(transactionsIds: $ids, bookmarked: ${bookmarked}) { success } }`, { ids: transactionIds });
  }

  async setCustomActivity(subTransactionId: string, financialAction: string) {
    return this.mutate(`mutation { setCustomActivity(subTransactionId: "${subTransactionId}", financialAction: "${financialAction}") { success } }`);
  }

  async setCustomAccountName(internalAccountId: string, name: string) {
    return this.mutate(`mutation { setCustomAccountName(internalAccountId: "${internalAccountId}", name: "${name}") { success } }`);
  }

  async ignoreTransaction(transactionId: string) {
    return this.mutate(`mutation { ignoreTransaction(transactionId: "${transactionId}") { success } }`);
  }

  async undoIgnoreTransaction(transactionId: string) {
    return this.mutate(`mutation { undoIgnoreTransaction(transactionId: "${transactionId}") { success } }`);
  }

  async markInternalTransfer(subTransactionIds: string[]) {
    return this.mutate(`mutation($ids: [ID]!) { markInternalTransfer(subTransactionIds: $ids) { success } }`, { ids: subTransactionIds });
  }

  async splitSubTransaction(subTransactionId: string, splits: Array<{ amount: number; financialAction?: string }>) {
    return this.mutate(`mutation($id: ID!, $splits: [SplitInput]!) { splitSubTransaction(subTransactionId: $id, splits: $splits) { success } }`, { id: subTransactionId, splits });
  }

  async setManualFiatValue(subTransactionId: string, value: number, currency: string) {
    return this.mutate(`mutation { setManualFiatValue(subTransactionId: "${subTransactionId}", value: ${value}, currency: ${currency}) { success } }`);
  }

  async createNotificationRule(name: string, type: string, conditions: any) {
    return this.mutate(`mutation($name: String!, $type: String!, $conditions: GenericScalar!) { createNotificationRule(name: $name, type: $type, conditions: $conditions) { success } }`, { name, type, conditions });
  }

  async deleteNotificationRule(id: string) {
    return this.mutate(`mutation { deleteNotificationRule(ruleId: "${id}") { success } }`);
  }

  async createReport(input: Record<string, any>) {
    return this.mutate(`mutation($input: RecurringReportInput!) { createRecurringReport(input: $input) { success report { id name } } }`, { input });
  }

  async queryReport(reportId: string) {
    return this.mutate(`mutation { queryReport(reportId: "${reportId}") { success data } }`);
  }

  async rerunReport(reportId: string) {
    return this.mutate(`mutation { rerunReport(reportId: "${reportId}") { success } }`);
  }

  async syncIntegration(integrationId: string) {
    return this.mutate(`mutation { syncIntegration(integrationId: "${integrationId}") { success } }`);
  }

  async triggerCostBasis() {
    return this.mutate(`mutation { triggerCostBasis { success } }`);
  }

  async triggerTrialBalance(sources?: string[]) {
    const srcArg = sources?.length ? `(sources: [${sources.map(s => `"${s}"`).join(', ')}])` : '';
    return this.mutate(`mutation { triggerTrialBalance${srcArg} { success } }`);
  }

  async generateRollForwardView(name: string, startDate: string, endDate: string) {
    return this.mutate(`mutation { generateRollForwardView(name: "${name}", startDate: "${startDate}", endDate: "${endDate}") { success } }`);
  }

  async updateInternalAccount(id: string, updates: Record<string, any>) {
    const args = [`id: "${id}"`];
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v === 'string') args.push(`${k}: "${v}"`);
      else args.push(`${k}: ${v}`);
    }
    return this.mutate(`mutation { updateInternalAccount(${args.join(', ')}) { success } }`);
  }

  async createTaxFormSession(name: string, type: string, year: number) {
    return this.mutate(`mutation { createTaxFormSession(name: "${name}", type: "${type}", year: ${year}) { success session { id } } }`);
  }

  async syncReportToExternal(reportId: string) {
    return this.mutate(`mutation { syncReportToExternal(reportId: "${reportId}") { success } }`);
  }

  async createWorkflow(input: Record<string, any>) {
    return this.mutate(`mutation($input: WorkflowInput!) { createOrUpdateWorkflow(input: $input) { success workflow { id } } }`, { input });
  }

  async updateCostBasisStrategy(strategy: string, date?: string) {
    const args = [`strategy: "${strategy}"`];
    if (date) args.push(`date: "${date}"`);
    return this.mutate(`mutation { updateCostBasisStrategyByDate(${args.join(', ')}) { success } }`);
  }

  async createTransactionComment(transactionId: string, content: string) {
    return this.mutate(`mutation { createTransactionComment(transactionId: "${transactionId}", content: "${content}") { success } }`);
  }

  async deleteTransactionComment(commentId: string) {
    return this.mutate(`mutation { deleteTransactionComment(commentId: "${commentId}") { success } }`);
  }

  async calculateBatchFiatValues(transactionIds: string[]) {
    return this.mutate(`mutation($ids: [ID]!) { calculateBatchTransactionsFiatValues(transactionsIds: $ids) { success } }`, { ids: transactionIds });
  }

  async inviteUser(email: string, userType?: string) {
    const args = [`email: "${email}"`];
    if (userType) args.push(`userType: "${userType}"`);
    return this.mutate(`mutation { inviteUser(${args.join(', ')}) { success } }`);
  }

  async startTresAgentChat(message: string) {
    return this.mutate(`mutation { startTresAgentChat(message: "${message}") { success chatId } }`);
  }

  async sendTresAgentMessage(chatId: string, message: string) {
    return this.mutate(`mutation { sendTresAgentMessage(chatId: "${chatId}", message: "${message}") { success response } }`);
  }

  async setInternalAccountTags(internalAccountId: string, tagIds: string[]) {
    return this.mutate(`mutation($id: ID!, $tagIds: [ID]!) { setInternalAccountTags(internalAccountId: $id, tagIds: $tagIds) { success } }`, { id: internalAccountId, tagIds });
  }

  async updateInternalAccountStatuses(ids: string[], status: string) {
    return this.mutate(`mutation($ids: [ID]!, $status: String!) { updateInternalAccountsStatuses(ids: $ids, status: $status) { success } }`, { ids, status });
  }

  // ===== DELTA: Wallet Mutations =====

  async createBatchWallets(wallets: Array<{ parentPlatform: string; name: string; identifier: string }>) {
    const walletEntries = wallets.map(w =>
      `{ parentPlatform: ${w.parentPlatform}, name: "${w.name}", identifier: "${w.identifier}" }`
    ).join(', ');
    return this.mutate(`mutation { updateBatchInternalAccounts(internalAccounts: [${walletEntries}]) { internalAccounts { name identifier parentPlatform id } } }`);
  }

  async deleteWallet(identifier: string, parentPlatform: string, deleteInternalAccount: boolean) {
    return this.mutate(`mutation { deleteInternalAccount(deleteInternalAccount: ${deleteInternalAccount}, identifier: "${identifier}", parentPlatform: ${parentPlatform}) { errors } }`);
  }

  // ===== DELTA: Manual Transaction Mutations =====

  async createManualTransactionV2(identifier: string, platform: string, timestamp: string, methodId?: string) {
    const args = [`identifier: "${identifier}"`, `platform: ${platform}`, `timestamp: "${timestamp}"`];
    if (methodId) args.push(`methodId: "${methodId}"`);
    return this.mutate(`mutation { createOrUpdateManualTransaction(${args.join(', ')}) { transaction { identifier platform timestamp id methodId } } }`);
  }

  async createManualSubTransactionV2(params: {
    amount: number; platform: string; fiatCurrency: string; fiatValue?: number;
    assetId: string; belongsToId: string; thirdPartyIdentifier: string;
    transactionId: string; direction: string; typeId: string; financialAction: string;
  }) {
    return this.mutate(`mutation($amount: Decimal!, $fiatValue: Decimal, $assetId: ID!, $belongsToId: ID!, $thirdPartyIdentifier: String!, $transactionId: ID!, $direction: Direction, $typeId: ID!, $action: FinancialAction!, $platform: Platform!, $fiatCurrency: Currency!) {
      createOrUpdateManualSubTransaction(amount: $amount, assetId: $assetId, belongsToId: $belongsToId, thirdPartyIdentifier: $thirdPartyIdentifier, transactionId: $transactionId, direction: $direction, typeId: $typeId, financialAction: $action, platform: $platform, fiatValue: $fiatValue, fiatCurrency: $fiatCurrency) { subTransaction { id } }
    }`, {
      amount: params.amount, fiatValue: params.fiatValue, assetId: params.assetId,
      belongsToId: params.belongsToId, thirdPartyIdentifier: params.thirdPartyIdentifier,
      transactionId: params.transactionId, direction: params.direction,
      typeId: params.typeId, action: params.financialAction,
      platform: params.platform, fiatCurrency: params.fiatCurrency,
    });
  }

  async groupSubTransactions(assetId: string, belongsToId: string, transactionId: string) {
    return this.mutate(`mutation { groupSubTransactions(assetId: "${assetId}", belongsToId: "${belongsToId}", transactionId: "${transactionId}") { subTransaction { id } } }`);
  }

  async undoSplitSubTransaction(subTxId: string) {
    return this.mutate(`mutation { undoSplitSubTransaction(subTxId: "${subTxId}") { success message restoredSubTxId restoredTxId } }`);
  }

  // ===== DELTA: Commit / Data Collection =====

  async triggerCommit(internalAccountIds?: string[], fromDate?: string, toDate?: string, commitId?: string) {
    const args: string[] = [];
    if (internalAccountIds?.length) args.push(`internalAccountIds: [${internalAccountIds.map(id => `"${id}"`).join(', ')}]`);
    if (fromDate) args.push(`fromDate: "${fromDate}"`);
    if (toDate) args.push(`toDate: "${toDate}"`);
    if (commitId) args.push(`commitId: "${commitId}"`);
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.mutate(`mutation { triggerCommit${argStr} { status message commitId } }`);
  }

  async triggerParallelCommit(params: {
    fromDate: string; toDate: string;
    internalAccountIds?: string[]; internalAccountIdentifiers?: string[];
    commitId?: string; assetsToCollect?: string[]; fetchFullHistory?: boolean;
    maxTransactionLimit?: number;
  }) {
    const vars: any = { fromDate: params.fromDate, toDate: params.toDate };
    const defs: string[] = ['$fromDate: DateTime!', '$toDate: DateTime!'];
    const uses: string[] = ['fromDate: $fromDate', 'toDate: $toDate'];
    if (params.internalAccountIds) { vars.internalAccountIds = params.internalAccountIds; defs.push('$internalAccountIds: [ID]'); uses.push('internalAccountIds: $internalAccountIds'); }
    if (params.internalAccountIdentifiers) { vars.internalAccountIdentifiers = params.internalAccountIdentifiers; defs.push('$internalAccountIdentifiers: [String]'); uses.push('internalAccountIdentifiers: $internalAccountIdentifiers'); }
    if (params.commitId) { vars.commitId = params.commitId; defs.push('$commitId: UUID'); uses.push('commitId: $commitId'); }
    if (params.assetsToCollect) { vars.assetsToCollect = params.assetsToCollect; defs.push('$assetsToCollect: [String]'); uses.push('assetsToCollect: $assetsToCollect'); }
    if (params.fetchFullHistory !== undefined) { vars.fetchFullHistory = params.fetchFullHistory; defs.push('$fetchFullHistory: Boolean'); uses.push('fetchFullHistory: $fetchFullHistory'); }
    if (params.maxTransactionLimit) { vars.maxTransactionLimit = params.maxTransactionLimit; defs.push('$maxTransactionLimit: Int'); uses.push('maxTransactionLimit: $maxTransactionLimit'); }
    return this.mutate(`mutation(${defs.join(', ')}) { triggerParallelCommit(${uses.join(', ')}) { status message commitId } }`, vars);
  }

  async checkParallelCommitRecon(commitId: string) {
    return this.query(`query($commitId: UUID!) { checkParallelCommitReconciliationStatus(commitId: $commitId) {
      inflowAmount outflowAmount feeAmount totalAmount openingBalance closingBalance balanceDiff reconciliationDiff
      internalAccountIdentifier assetKey reconciliationDiffUsd internalAccountName fromDate toDate isReconciled
    } }`, { commitId });
  }

  async updateCommitMaxTxLimit(commitId: string, maxTransactionLimit: number) {
    return this.mutate(`mutation($commitId: UUID!, $maxTransactionLimit: Int!) { updateCommitMaxTransactionLimit(commitId: $commitId, maxTransactionLimit: $maxTransactionLimit) { success } }`, { commitId, maxTransactionLimit });
  }

  async killCommits(commitIds?: string[]) {
    if (commitIds?.length) {
      return this.mutate(`mutation($commitIds: [String]) { killCommits(commitIds: $commitIds) { status } }`, { commitIds });
    }
    return this.mutate(`mutation { killCommits { status } }`);
  }

  // ===== DELTA: Locked Periods =====

  async listLockedPeriods() {
    return this.query(`{ lockedPeriod { totalCount results { updatedAt lockDate note isCurrentLock lockedBy } } }`);
  }

  async createLockedPeriod(lockDate: string, note?: string) {
    const args = [`lockDate: "${lockDate}"`];
    if (note) args.push(`note: "${note}"`);
    return this.mutate(`mutation { createLockedPeriod(${args.join(', ')}) { success } }`);
  }

  async updateLockedPeriod(lockedPeriodId: number, note: string) {
    return this.mutate(`mutation { updateLockedPeriod(lockedPeriodId: ${lockedPeriodId}, note: "${note}") { success } }`);
  }

  async deleteLockedPeriod(lockedPeriodId: number) {
    return this.mutate(`mutation { deleteLockedPeriod(lockedPeriodId: ${lockedPeriodId}) { success } }`);
  }

  // ===== DELTA: Admin =====

  async getAdminPage() {
    return this.query(`{ admin { orgName users { userId email userType name picture invitationExpired } organizationSettings { costBasisStrategy calculateCostBasisByInternalAccount } } }`);
  }

  async deleteUser(userId: string) {
    return this.mutate(`mutation { deleteUser(userId: "${userId}") { success } }`);
  }

  async setUserType(userId: string, userType: string) {
    return this.mutate(`mutation { setUserType(userId: "${userId}", userType: ${userType}) { success } }`);
  }

  async setPlatformCollectionStatus(statuses: Array<{ platform: string; enabled: boolean }>) {
    return this.mutate(`mutation($platformCollectionStatuses: [PlatformCollectionStatusInputType]!) { setPlatformCollectionStatus(platformCollectionStatuses: $platformCollectionStatuses) { success } }`, { platformCollectionStatuses: statuses });
  }

  // ===== DELTA: Classification Rules =====

  async createClassificationRule(params: {
    activity: string; parentPlatform?: string; methodId?: string;
    recipientIdentifier?: string; senderIdentifier?: string; priority?: number;
    senderInternalAccountTag?: string; recipientInternalAccountTag?: string;
    senderContactTag?: string; recipientContactTag?: string;
  }) {
    const vars: any = { activity: params.activity };
    const defs: string[] = ['$activity: String!'];
    const uses: string[] = ['activity: $activity'];
    if (params.parentPlatform) { vars.parentPlatform = params.parentPlatform; defs.push('$parentPlatform: ParentPlatform'); uses.push('parentPlatform: $parentPlatform'); }
    if (params.methodId) { vars.methodId = params.methodId; defs.push('$methodId: String'); uses.push('methodId: $methodId'); }
    if (params.recipientIdentifier) { vars.recipientIdentifier = params.recipientIdentifier; defs.push('$recipientIdentifier: String'); uses.push('recipientIdentifier: $recipientIdentifier'); }
    if (params.senderIdentifier) { vars.senderIdentifier = params.senderIdentifier; defs.push('$senderIdentifier: String'); uses.push('senderIdentifier: $senderIdentifier'); }
    if (params.priority !== undefined) { vars.priority = params.priority; defs.push('$priority: Int'); uses.push('priority: $priority'); }
    if (params.senderInternalAccountTag) { vars.senderInternalAccountTag = params.senderInternalAccountTag; defs.push('$senderInternalAccountTag: String'); uses.push('senderInternalAccountTag: $senderInternalAccountTag'); }
    if (params.recipientInternalAccountTag) { vars.recipientInternalAccountTag = params.recipientInternalAccountTag; defs.push('$recipientInternalAccountTag: String'); uses.push('recipientInternalAccountTag: $recipientInternalAccountTag'); }
    if (params.senderContactTag) { vars.senderContactTag = params.senderContactTag; defs.push('$senderContactTag: String'); uses.push('senderContactTag: $senderContactTag'); }
    if (params.recipientContactTag) { vars.recipientContactTag = params.recipientContactTag; defs.push('$recipientContactTag: String'); uses.push('recipientContactTag: $recipientContactTag'); }
    return this.mutate(`mutation(${defs.join(', ')}) { createTransactionClassificationRule(${uses.join(', ')}) { success } }`, vars);
  }

  async updateClassificationRule(id: string, activity: string, priority?: number) {
    const args = [`id: "${id}"`, `activity: "${activity}"`];
    if (priority !== undefined) args.push(`priority: ${priority}`);
    return this.mutate(`mutation { updateTransactionClassificationRule(${args.join(', ')}) { success } }`);
  }

  async deleteClassificationRule(key: string) {
    return this.mutate(`mutation { deleteTransactionClassificationRule(key: "${key}") { success } }`);
  }

  // ===== DELTA: Reconciliation Writes =====

  async createGapFillRule(internalAccountId: number, assetId: string, interval: string, name: string) {
    return this.mutate(`mutation { createReconciliationGapFillRule(internalAccountId: ${internalAccountId}, assetId: "${assetId}", interval: ${interval}, name: "${name}") { success message ruleId workflowIdentifiers { workflowId runId } } }`);
  }

  async deleteGapFillRules(ruleIds: string[]) {
    return this.mutate(`mutation($ruleIds: [String]!) { deleteReconciliationGapFillRule(ruleIds: $ruleIds) { success message } }`, { ruleIds });
  }

  async createManualSubFromFillers(internalAccountId: number, asset: string, methodId?: string, fillerIds?: string[]) {
    const vars: any = { internalAccountId, asset };
    const defs: string[] = ['$internalAccountId: Int!', '$asset: String!'];
    const uses: string[] = ['internalAccountId: $internalAccountId', 'asset: $asset'];
    if (methodId) { vars.methodId = methodId; defs.push('$methodId: String'); uses.push('methodId: $methodId'); }
    if (fillerIds?.length) { vars.fillerIds = fillerIds; defs.push('$fillerIds: [ID]'); uses.push('fillerIds: $fillerIds'); }
    return this.mutate(`mutation(${defs.join(', ')}) { createManualSubTransactionsFromFillers(${uses.join(', ')}) { success message } }`, vars);
  }

  // ===== DELTA: Address Book =====

  async searchAddressBook(search?: string, limit?: number, offset?: number) {
    const args: string[] = [];
    if (search) args.push(`search: "${search}"`);
    if (limit) args.push(`limit: ${limit}`);
    if (offset) args.push(`offset: ${offset}`);
    const argStr = args.length ? `(${args.join(', ')})` : '';
    return this.query(`{ customAccountNameLabel${argStr} { totalCount results { id labelValue tags originalIdentifier } } }`);
  }

  async getIdentifiedAccounts(limit?: number, offset?: number, fiatCurrency?: string) {
    const args: string[] = ['excludeInternalAccounts: true', 'identificationState: "identified"'];
    if (limit) args.push(`limit: ${limit}`);
    if (offset) args.push(`offset: ${offset}`);
    if (fiatCurrency) args.push(`fiatCurrency: "${fiatCurrency}"`);
    return this.query(`{ accountTxsSummary(${args.join(', ')}) { totalCount results { id customLabel { labelValue tags originalIdentifier } accountIdentifier inflowFiatValue outflowFiatValue } } }`);
  }

  async getUnidentifiedAddresses(limit?: number, offset?: number, fiatCurrency?: string, accountDirection?: string) {
    const args: string[] = ['excludeInternalAccounts: true', 'identificationState: "unidentified"', 'ordering: "-outflowTxCount,"'];
    if (limit) args.push(`limit: ${limit}`);
    if (offset) args.push(`offset: ${offset}`);
    if (fiatCurrency) args.push(`fiatCurrency: "${fiatCurrency}"`);
    if (accountDirection) args.push(`accountDirection: "${accountDirection}"`);
    return this.query(`{ accountTxsSummary(${args.join(', ')}) { totalCount results { accountIdentifier outflowFiatValue outflowTxCount } } }`);
  }

  async getAddressBookTags() {
    return this.query(`{ ledgerFilters { customNameLabelTags { displayName id } } }`);
  }

  async setAddressBookName(identifier: string, labelValue: string) {
    return this.mutate(`mutation { setCustomAccountName(identifier: "${identifier}", labelValue: "${labelValue}") { accountTxsSummary { customLabel { labelValue tags originalIdentifier } accountIdentifier } } }`);
  }

  async setAddressBookTags(identifier: string, tags: string[]) {
    const tagArr = tags.map(t => `"${t}"`).join(', ');
    return this.mutate(`mutation { setCustomAccountNameLabelTags(identifier: "${identifier}", tags: [${tagArr}]) { accountTxsSummary { customLabel { labelValue tags } accountIdentifier } } }`);
  }

  async deleteAddressBookName(identifier: string, labelValue: string) {
    return this.mutate(`mutation { deleteCustomAccountNameLabel(identifier: "${identifier}", labelValue: "${labelValue}") { status } }`);
  }

  // ===== DELTA: Recurring Reports =====

  async listRecurringReports() {
    return this.query(`{ recurringReportQuery { totalCount results { id createdAt updatedAt name description exportType when enable } } }`);
  }

  async createRecurringReport(params: { exportType: string; name: string; enable?: boolean; when: any }) {
    return this.mutate(`mutation($exportType: ReportGeneratorType!, $name: String!, $enable: Boolean, $when: WhenInput!) {
      createRecurringReport(exportType: $exportType, name: $name, enable: $enable, when: $when) { status recurringReport { id when } }
    }`, params);
  }

  async deleteRecurringReport(id: string) {
    return this.mutate(`mutation { deleteRecurringReport(id: "${id}") { status } }`);
  }

  // ===== DELTA: Report Types & Sync =====

  async getAvailableReportTypes() {
    return this.query(`{ availableReportTypes { name entitiesType exportType description exampleReport } }`);
  }

  async syncReportToExternalV2(id: number, resource: string) {
    return this.mutate(`mutation { syncReportToExternal(id: ${id}, resource: ${resource}) { status } }`);
  }

  async deleteSubTransaction(id: string) {
    return this.mutate(`mutation { deleteSubTransaction(subTransactionId: "${id}") { success } }`);
  }

  async restoreSubTransaction(id: string) {
    return this.mutate(`mutation { restoreSubTx(subTransactionId: "${id}") { success } }`);
  }

  async deleteTransaction(id: string) {
    return this.mutate(`mutation { deleteTransaction(transactionId: "${id}") { success } }`);
  }

  async restoreTransaction(id: string) {
    return this.mutate(`mutation { restoreTx(transactionId: "${id}") { success } }`);
  }
}
