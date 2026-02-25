const BASE_URL = 'https://ccview.io';

export class CCViewClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CCView API Error ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text() as unknown as T;
  }

  private async postRequest<T>(endpoint: string, body: Record<string, any>): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CCView API Error ${response.status}: ${text}`);
    }

    return response.json();
  }

  // ===== Health =====
  async getHealth(): Promise<any> {
    return this.request<any>('/api/v1/health');
  }

  // ===== Explore =====
  async getNetworkStats(): Promise<any> {
    return this.request<any>('/api/v2/explore/stats');
  }

  async getTokenPrices(): Promise<any> {
    return this.request<any>('/api/v2/explore/prices');
  }

  async getTokenPricesList(params?: { coin_type?: string; start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v1/explore/prices-list', params);
  }

  async getSupplyStats(params?: { start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v2/explore/supply-stats', params);
  }

  async getDailyTransferStats(params?: { start?: string; end?: string }): Promise<any> {
    return this.request<any>('/api/v1/explore/transfer-stat-per-day', params);
  }

  async getTransferVolumeStat(params?: { start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v2/explore/volume/stat', params);
  }

  // ===== ANS =====
  async checkAnsAvailability(ans: string): Promise<any> {
    return this.request<any>(`/api/v1/ans/available/${encodeURIComponent(ans)}`);
  }

  async listAnsByName(ans: string, params?: { limit?: number; offset?: number }): Promise<any> {
    return this.request<any>(`/api/v1/ans/context/list-by-name/${encodeURIComponent(ans)}`, params);
  }

  async listAnsByParty(partyId: string, params?: { limit?: number; offset?: number }): Promise<any> {
    return this.request<any>(`/api/v1/ans/context/list-by-party/${encodeURIComponent(partyId)}`, params);
  }

  async listAnsForParty(partyId: string, params?: { limit?: number; offset?: number }): Promise<any> {
    return this.request<any>(`/api/v1/ans/list/${encodeURIComponent(partyId)}`, params);
  }

  async getAnsRequestStatus(reference: string): Promise<any> {
    return this.request<any>(`/api/v1/ans/req-details/${encodeURIComponent(reference)}`);
  }

  // ===== General Search =====
  async generalSearch(term: string): Promise<any> {
    return this.request<any>('/api/v1/general-search', { term });
  }

  // ===== Governance =====
  async listGovernances(params?: { cursor?: number; limit?: number; search?: string }): Promise<any> {
    return this.request<any>('/api/v2/governances', params);
  }

  async listActiveGovernances(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/governances/active', params);
  }

  async listCompletedGovernances(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/governances/completed', params);
  }

  async getGovernanceDetails(trackingCid: string): Promise<any> {
    return this.request<any>(`/api/v1/governances/details/${encodeURIComponent(trackingCid)}`);
  }

  async getGovernanceStatistics(): Promise<any> {
    return this.request<any>('/api/v1/governances/statistics');
  }

  async getGovernancePriceVotes(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/governances/price-votes', params);
  }

  // ===== Validators =====
  async listValidators(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/validators', params);
  }

  async getValidatorDetails(validatorId: string): Promise<any> {
    return this.request<any>(`/api/v1/validators/${encodeURIComponent(validatorId)}`);
  }

  async getValidatorStatistics(): Promise<any> {
    return this.request<any>('/api/v1/validators/statistics');
  }

  async getValidatorPerformance(params: { validator_id: string; start_datetime: string; end_datetime: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v1/validators/perfomance-ranged', params);
  }

  // ===== Super Validators =====
  async listHostedSuperValidators(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/super-validators/hosted', params);
  }

  async listStandaloneSuperValidators(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/super-validators/standalone', params);
  }

  async listEscrowParties(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/super-validators/escrow', params);
  }

  async listOnboardedValidators(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/super-validators/onboarded-validators', params);
  }

  // ===== Token Transfers =====
  async listTokenTransfers(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v3/token-transfers', params);
  }

  async listTokenTransfersByParty(params: { party_id: string; cursor?: number; limit?: number; role?: string }): Promise<any> {
    return this.request<any>('/api/v3/token-transfers/by-party', params);
  }

  async listTokenTransfersByPartyPair(params: { sender_party_id: string; receiver_party_id: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v3/token-transfers/by-party-pair', params);
  }

  async getTokenTransferDetails(eventId: string): Promise<any> {
    return this.request<any>(`/api/v2/token-transfers/${encodeURIComponent(eventId)}`);
  }

  async getTransferStatRanged(params?: { start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v2/token-transfers/stat-ranged', params);
  }

  async getTransferTrafficRanged(params: { validator_id: string; start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v2/token-transfers/traffic-ranged', params);
  }

  async getTransferVerdict(updateId: string): Promise<any> {
    return this.request<any>(`/api/v2/token-transfers/verdict/${encodeURIComponent(updateId)}`);
  }

  async listPrivateTransfers(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/token-transfers/private', params);
  }

  // ===== Updates =====
  async listUpdates(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v3/updates', params);
  }

  async listUpdatesByParty(params: { party_id: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v3/updates/by-party', params);
  }

  async getUpdateDetails(updateId: string): Promise<any> {
    return this.request<any>(`/api/v3/updates/${encodeURIComponent(updateId)}`);
  }

  async getUpdateStats(): Promise<any> {
    return this.request<any>('/api/v1/updates/stats');
  }

  async getUpdateTopParties(): Promise<any> {
    return this.request<any>('/api/v1/updates/stats/top-parties');
  }

  async getUpdateStatRanged(params?: { start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v2/updates/stat-ranged', params);
  }

  async getUpdateChart(params?: { start?: string; end?: string }): Promise<any> {
    return this.request<any>('/api/v1/updates/chart', params);
  }

  // ===== Parties =====
  async getPartyDetails(partyId: string): Promise<any> {
    return this.request<any>(`/api/v1/parties/${encodeURIComponent(partyId)}`);
  }

  async getPartyCounterparties(params: { party_id: string; limit?: number; offset?: number }): Promise<any> {
    return this.request<any>('/api/v1/parties/counterparties', params);
  }

  async getPartyInteractions(params: { party_id: string; counterparty_id: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v1/parties/interactions', params);
  }

  async getPartyInteractionsChart(params: { party_id: string; counterparty_id: string; start?: string; end?: string }): Promise<any> {
    return this.request<any>('/api/v1/parties/interactions-chart', params);
  }

  async getPartyBalanceChanges(params: { party_id: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/parties/balance-changes', params);
  }

  async getPartyFeeStat(params: { party_id: string; start_datetime: string; end_datetime: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v1/parties/fee-stat-ranged', params);
  }

  async getPartyTransfersStat(params: { party_id: string; start_datetime: string; end_datetime: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v1/parties/transfers-count-stat-ranged', params);
  }

  async getPartyUpdateStat(params: { party_id: string; start_datetime: string; end_datetime: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v1/parties/update-stat-ranged', params);
  }

  async getActivePartyStat(params?: { start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v2/parties/stat/ranged', params);
  }

  async resolveParties(partyIds: string[]): Promise<any> {
    return this.postRequest<any>('/api/v1/parties/resolve', { party_ids: partyIds });
  }

  // ===== Rewards =====
  async listRewards(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v1/rewards/list', params);
  }

  async getRewardsStatistic(params?: { start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v2/rewards/statistic', params);
  }

  async getRewardsDailyStatistic(params?: { start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v1/rewards/daily_statistic', params);
  }

  async getRewardsLeaderboardTop(params?: { limit?: number }): Promise<any> {
    return this.request<any>('/api/v1/rewards/leaderboard/top', params);
  }

  async getRewardsLeaderboardStat(): Promise<any> {
    return this.request<any>('/api/v1/rewards/leaderboard/stat');
  }

  async getTopByAmount(params?: { limit?: number }): Promise<any> {
    return this.request<any>('/api/v1/rewards/top-by-amount', params);
  }

  async getTopByAmountDaily(params?: { limit?: number }): Promise<any> {
    return this.request<any>('/api/v1/rewards/top-by-amount-daily', params);
  }

  async getMissedRewardsStatistic(params?: { start_datetime?: string; end_datetime?: string; granularity?: string }): Promise<any> {
    return this.request<any>('/api/v1/rewards/missed/statistic', params);
  }

  async getTopAppBeneficiary(params?: { limit?: number }): Promise<any> {
    return this.request<any>('/api/v1/rewards/app/top-beneficiary', params);
  }

  // ===== Offers =====
  async searchOffers(params?: { party_id?: string; role?: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/offers/search', params);
  }

  async getOfferStats(): Promise<any> {
    return this.request<any>('/api/v2/offers/stat');
  }

  // ===== Featured Apps =====
  async listFeaturedApps(params?: { cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/featured-apps', params);
  }

  async getTop5FeaturedApps(): Promise<any> {
    return this.request<any>('/api/v2/featured-apps/top5');
  }

  async getFaamTrafficByParty(params: { party_id: string; start_datetime: string; end_datetime: string }): Promise<any> {
    return this.request<any>('/api/v2/featured-apps/faam-traffic-stat-by-party', params);
  }

  async getFaamCoverageByParty(params: { party_id: string; start_datetime: string; end_datetime: string }): Promise<any> {
    return this.request<any>('/api/v2/featured-apps/faam-coverage-by-party', params);
  }

  // ===== Consolidations =====
  async searchConsolidations(params?: { party_id?: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v1/consolidation/search', params);
  }

  async getConsolidationDetails(eventId: string): Promise<any> {
    return this.request<any>(`/api/v1/consolidation/${encodeURIComponent(eventId)}`);
  }

  // ===== Transfer Allocations / Commands / Instructions / Preapprovals =====
  async searchTransferAllocations(params?: { sender_party_id?: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/token-transfer-allocations/search', params);
  }

  async searchTransferCommands(params?: { sender_party_id?: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/token-transfer-commands/search', params);
  }

  async searchTransferInstructions(params?: { sender_party_id?: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/token-transfer-instructions/search', params);
  }

  async getTransferInstructionDetails(eventId: string): Promise<any> {
    return this.request<any>(`/api/v1/token-transfer-instructions/${encodeURIComponent(eventId)}`);
  }

  async searchTransferPreapprovals(params?: { receiver_party_id?: string; cursor?: number; limit?: number }): Promise<any> {
    return this.request<any>('/api/v2/transfer-preapprovals/search', params);
  }

  // ===== Mining Rounds (v1 only) =====
  async listMiningRounds(params?: { cursor?: string; limit?: number; search?: string }): Promise<any> {
    return this.request<any>('/api/v1/mining-rounds', params);
  }

  async getActiveMiningRounds(): Promise<any> {
    return this.request<any>('/api/v1/mining-rounds/active');
  }

  async searchMiningRounds(params?: { round?: number }): Promise<any> {
    return this.request<any>('/api/v1/mining-rounds/search', params);
  }
}
