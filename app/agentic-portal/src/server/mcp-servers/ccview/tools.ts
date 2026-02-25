import { z } from 'zod';
import { CCViewClient } from './api-client';

interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  handler: (client: CCViewClient, args: any) => Promise<any>;
}

export const tools: ToolDef[] = [
  // ===== Health =====
  {
    name: 'health_check',
    description: 'Check CCView API health status',
    inputSchema: z.object({}),
    handler: async (client) => client.getHealth(),
  },

  // ===== Explore =====
  {
    name: 'explore_network_stats',
    description: 'Get Canton network stats (price, supply, validators)',
    inputSchema: z.object({}),
    handler: async (client) => client.getNetworkStats(),
  },
  {
    name: 'explore_token_prices',
    description: 'Get CC token price changes over time periods',
    inputSchema: z.object({}),
    handler: async (client) => client.getTokenPrices(),
  },
  {
    name: 'explore_price_history',
    description: 'Get detailed token price history list',
    inputSchema: z.object({
      coin_type: z.string().optional().describe('Token type (CC, CBTC, USDC)'),
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getTokenPricesList(args),
  },
  {
    name: 'explore_supply_stats',
    description: 'Get supply, price, market-cap snapshots',
    inputSchema: z.object({
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getSupplyStats(args),
  },
  {
    name: 'explore_daily_transfer_stats',
    description: 'Get daily transfer volume statistics',
    inputSchema: z.object({
      start: z.string().optional().describe('Start date YYYY-MM-DD'),
      end: z.string().optional().describe('End date YYYY-MM-DD'),
    }),
    handler: async (client, args) => client.getDailyTransferStats(args),
  },
  {
    name: 'explore_volume_stat',
    description: 'Get transfer volume time series data',
    inputSchema: z.object({
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getTransferVolumeStat(args),
  },

  // ===== ANS =====
  {
    name: 'ans_check_availability',
    description: 'Check if ANS name is available',
    inputSchema: z.object({
      ans: z.string().describe('ANS name in DNS format'),
    }),
    handler: async (client, args) => client.checkAnsAvailability(args.ans),
  },
  {
    name: 'ans_list_by_name',
    description: 'List ANS context entries by name',
    inputSchema: z.object({
      ans: z.string().describe('ANS name to look up'),
      limit: z.number().optional().describe('Max results'),
      offset: z.number().optional().describe('Offset for pagination'),
    }),
    handler: async (client, args) => client.listAnsByName(args.ans, { limit: args.limit, offset: args.offset }),
  },
  {
    name: 'ans_list_by_party',
    description: 'List ANS context entries by party ID',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      limit: z.number().optional().describe('Max results'),
      offset: z.number().optional().describe('Offset for pagination'),
    }),
    handler: async (client, args) => client.listAnsByParty(args.party_id, { limit: args.limit, offset: args.offset }),
  },
  {
    name: 'ans_list_for_party',
    description: 'List all ANS names owned by a party',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      limit: z.number().optional().describe('Max results'),
      offset: z.number().optional().describe('Offset for pagination'),
    }),
    handler: async (client, args) => client.listAnsForParty(args.party_id, { limit: args.limit, offset: args.offset }),
  },

  // ===== General Search =====
  {
    name: 'general_search',
    description: 'Search across parties, transfers, governance',
    inputSchema: z.object({
      term: z.string().describe('Search term'),
    }),
    handler: async (client, args) => client.generalSearch(args.term),
  },

  // ===== Governance =====
  {
    name: 'governance_list',
    description: 'List governance proposals with pagination',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor (integer)'),
      limit: z.number().optional().describe('Page size (max 100)'),
      search: z.string().optional().describe('Search filter'),
    }),
    handler: async (client, args) => client.listGovernances(args),
  },
  {
    name: 'governance_list_active',
    description: 'List active governance proposals',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listActiveGovernances(args),
  },
  {
    name: 'governance_list_completed',
    description: 'List completed governance proposals',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listCompletedGovernances(args),
  },
  {
    name: 'governance_get_details',
    description: 'Get details of a governance proposal',
    inputSchema: z.object({
      tracking_cid: z.string().describe('Governance tracking CID'),
    }),
    handler: async (client, args) => client.getGovernanceDetails(args.tracking_cid),
  },
  {
    name: 'governance_statistics',
    description: 'Get governance aggregate statistics',
    inputSchema: z.object({}),
    handler: async (client) => client.getGovernanceStatistics(),
  },
  {
    name: 'governance_price_votes',
    description: 'List Amulet price votes',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.getGovernancePriceVotes(args),
  },

  // ===== Validators =====
  {
    name: 'validator_list',
    description: 'List all Canton validators',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listValidators(args),
  },
  {
    name: 'validator_get_details',
    description: 'Get validator details by ID',
    inputSchema: z.object({
      validator_id: z.string().describe('Validator ID'),
    }),
    handler: async (client, args) => client.getValidatorDetails(args.validator_id),
  },
  {
    name: 'validator_statistics',
    description: 'Get validator counts (total, active, inactive)',
    inputSchema: z.object({}),
    handler: async (client) => client.getValidatorStatistics(),
  },
  {
    name: 'validator_performance',
    description: 'Get validator performance over date range',
    inputSchema: z.object({
      validator_id: z.string().describe('Validator ID'),
      start_datetime: z.string().describe('Start datetime ISO 8601'),
      end_datetime: z.string().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getValidatorPerformance(args),
  },

  // ===== Super Validators =====
  {
    name: 'super_validator_hosted',
    description: 'List hosted super-validators',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listHostedSuperValidators(args),
  },
  {
    name: 'super_validator_standalone',
    description: 'List standalone super-validators',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listStandaloneSuperValidators(args),
  },
  {
    name: 'super_validator_escrow',
    description: 'List escrow parties for super-validators',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listEscrowParties(args),
  },
  {
    name: 'super_validator_onboarded',
    description: 'List onboarded validators',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listOnboardedValidators(args),
  },

  // ===== Token Transfers =====
  {
    name: 'transfer_list',
    description: 'List token transfers with pagination',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listTokenTransfers(args),
  },
  {
    name: 'transfer_list_by_party',
    description: 'List transfers for a specific party',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
      role: z.string().optional().describe('Filter: sender, receiver, provider'),
    }),
    handler: async (client, args) => client.listTokenTransfersByParty(args),
  },
  {
    name: 'transfer_list_by_party_pair',
    description: 'List transfers between two parties',
    inputSchema: z.object({
      sender_party_id: z.string().describe('Sender party ID'),
      receiver_party_id: z.string().describe('Receiver party ID'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listTokenTransfersByPartyPair(args),
  },
  {
    name: 'transfer_get_details',
    description: 'Get transfer details by event ID',
    inputSchema: z.object({
      event_id: z.string().describe('Transfer event ID'),
    }),
    handler: async (client, args) => client.getTokenTransferDetails(args.event_id),
  },
  {
    name: 'transfer_stat_ranged',
    description: 'Get transfer statistics with granularity',
    inputSchema: z.object({
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getTransferStatRanged(args),
  },
  {
    name: 'transfer_traffic_by_validator',
    description: 'Get traffic stats for a validator',
    inputSchema: z.object({
      validator_id: z.string().describe('Validator ID'),
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getTransferTrafficRanged(args),
  },
  {
    name: 'transfer_verdict',
    description: 'Get transfer verdict/summary by update ID',
    inputSchema: z.object({
      update_id: z.string().describe('Update ID for the transfer'),
    }),
    handler: async (client, args) => client.getTransferVerdict(args.update_id),
  },
  {
    name: 'transfer_list_private',
    description: 'List private (confidential) transfers',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listPrivateTransfers(args),
  },

  // ===== Updates =====
  {
    name: 'update_list',
    description: 'List ledger updates with pagination',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listUpdates(args),
  },
  {
    name: 'update_list_by_party',
    description: 'List updates for a specific party',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listUpdatesByParty(args),
  },
  {
    name: 'update_get_details',
    description: 'Get update details with summary',
    inputSchema: z.object({
      update_id: z.string().describe('Ledger update ID'),
    }),
    handler: async (client, args) => client.getUpdateDetails(args.update_id),
  },
  {
    name: 'update_stats',
    description: 'Get ledger update statistics overview',
    inputSchema: z.object({}),
    handler: async (client) => client.getUpdateStats(),
  },
  {
    name: 'update_top_parties',
    description: 'Get top parties by update activity',
    inputSchema: z.object({}),
    handler: async (client) => client.getUpdateTopParties(),
  },
  {
    name: 'update_stat_ranged',
    description: 'Get update stats with granularity',
    inputSchema: z.object({
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getUpdateStatRanged(args),
  },

  // ===== Parties =====
  {
    name: 'party_get_details',
    description: 'Get party details by party ID',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
    }),
    handler: async (client, args) => client.getPartyDetails(args.party_id),
  },
  {
    name: 'party_counterparties',
    description: 'Get counterparty interaction stats',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      limit: z.number().optional().describe('Max results'),
      offset: z.number().optional().describe('Offset for pagination'),
    }),
    handler: async (client, args) => client.getPartyCounterparties(args),
  },
  {
    name: 'party_interactions',
    description: 'Get transfer interactions between two parties',
    inputSchema: z.object({
      party_id: z.string().describe('First party ID'),
      counterparty_id: z.string().describe('Second party ID'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.getPartyInteractions(args),
  },
  {
    name: 'party_balance_changes',
    description: 'Get party balance change history',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.getPartyBalanceChanges(args),
  },
  {
    name: 'party_fee_stat',
    description: 'Get burn fee stats for a party',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      start_datetime: z.string().describe('Start datetime ISO 8601'),
      end_datetime: z.string().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getPartyFeeStat(args),
  },
  {
    name: 'party_transfer_stat',
    description: 'Get daily transfer stats for a party',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      start_datetime: z.string().describe('Start datetime ISO 8601'),
      end_datetime: z.string().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getPartyTransfersStat(args),
  },
  {
    name: 'party_active_stat',
    description: 'Get active party statistics over time',
    inputSchema: z.object({
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getActivePartyStat(args),
  },
  {
    name: 'party_resolve',
    description: 'Resolve party IDs to specifications',
    inputSchema: z.object({
      party_ids: z.array(z.string()).describe('Array of party IDs'),
    }),
    handler: async (client, args) => client.resolveParties(args.party_ids),
  },

  // ===== Rewards =====
  {
    name: 'rewards_list',
    description: 'List reward distributions',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listRewards(args),
  },
  {
    name: 'rewards_statistic',
    description: 'Get reward statistics with granularity',
    inputSchema: z.object({
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getRewardsStatistic(args),
  },
  {
    name: 'rewards_leaderboard_top',
    description: 'Get top reward earners leaderboard',
    inputSchema: z.object({
      limit: z.number().optional().describe('Max results'),
    }),
    handler: async (client, args) => client.getRewardsLeaderboardTop(args),
  },
  {
    name: 'rewards_leaderboard_stat',
    description: 'Get rewards leaderboard statistics',
    inputSchema: z.object({}),
    handler: async (client) => client.getRewardsLeaderboardStat(),
  },
  {
    name: 'rewards_top_by_amount',
    description: 'Get top leaders by total reward amount',
    inputSchema: z.object({
      limit: z.number().optional().describe('Max results'),
    }),
    handler: async (client, args) => client.getTopByAmount(args),
  },
  {
    name: 'rewards_missed_statistic',
    description: 'Get missed rewards statistics',
    inputSchema: z.object({
      start_datetime: z.string().optional().describe('Start datetime ISO 8601'),
      end_datetime: z.string().optional().describe('End datetime ISO 8601'),
      granularity: z.string().optional().describe('hour, day, week, month'),
    }),
    handler: async (client, args) => client.getMissedRewardsStatistic(args),
  },
  {
    name: 'rewards_top_app_beneficiary',
    description: 'Get top featured app reward beneficiaries',
    inputSchema: z.object({
      limit: z.number().optional().describe('Max results'),
    }),
    handler: async (client, args) => client.getTopAppBeneficiary(args),
  },

  // ===== Offers =====
  {
    name: 'offers_search',
    description: 'Search offers by party and role',
    inputSchema: z.object({
      party_id: z.string().optional().describe('Filter by party ID'),
      role: z.string().optional().describe('Filter: sender, receiver'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.searchOffers(args),
  },
  {
    name: 'offers_stat',
    description: 'Get offer statistics',
    inputSchema: z.object({}),
    handler: async (client) => client.getOfferStats(),
  },

  // ===== Featured Apps =====
  {
    name: 'featured_apps_list',
    description: 'List featured apps on Canton Network',
    inputSchema: z.object({
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.listFeaturedApps(args),
  },
  {
    name: 'featured_apps_top5',
    description: 'Get top 5 featured apps',
    inputSchema: z.object({}),
    handler: async (client) => client.getTop5FeaturedApps(),
  },
  {
    name: 'featured_apps_traffic',
    description: 'Get FAAM traffic stats for a party',
    inputSchema: z.object({
      party_id: z.string().describe('Canton party ID'),
      start_datetime: z.string().describe('Start datetime ISO 8601'),
      end_datetime: z.string().describe('End datetime ISO 8601'),
    }),
    handler: async (client, args) => client.getFaamTrafficByParty(args),
  },

  // ===== Consolidations =====
  {
    name: 'consolidation_search',
    description: 'Search consolidation offers',
    inputSchema: z.object({
      party_id: z.string().optional().describe('Filter by party ID'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.searchConsolidations(args),
  },
  {
    name: 'consolidation_get_details',
    description: 'Get consolidation details by event ID',
    inputSchema: z.object({
      event_id: z.string().describe('Consolidation event ID'),
    }),
    handler: async (client, args) => client.getConsolidationDetails(args.event_id),
  },

  // ===== Transfer Sub-types =====
  {
    name: 'transfer_allocations_search',
    description: 'Search token transfer allocations',
    inputSchema: z.object({
      sender_party_id: z.string().optional().describe('Filter by sender party'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.searchTransferAllocations(args),
  },
  {
    name: 'transfer_commands_search',
    description: 'Search token transfer commands',
    inputSchema: z.object({
      sender_party_id: z.string().optional().describe('Filter by sender party'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.searchTransferCommands(args),
  },
  {
    name: 'transfer_instructions_search',
    description: 'Search token transfer instructions',
    inputSchema: z.object({
      sender_party_id: z.string().optional().describe('Filter by sender party'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.searchTransferInstructions(args),
  },
  {
    name: 'transfer_preapprovals_search',
    description: 'Search transfer preapprovals',
    inputSchema: z.object({
      receiver_party_id: z.string().optional().describe('Filter by receiver party'),
      cursor: z.number().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
    }),
    handler: async (client, args) => client.searchTransferPreapprovals(args),
  },

  // ===== Mining Rounds =====
  {
    name: 'mining_rounds_list',
    description: 'List mining rounds with pagination',
    inputSchema: z.object({
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().optional().describe('Page size'),
      search: z.string().optional().describe('Search filter'),
    }),
    handler: async (client, args) => client.listMiningRounds(args),
  },
  {
    name: 'mining_rounds_active',
    description: 'Get currently active mining rounds',
    inputSchema: z.object({}),
    handler: async (client) => client.getActiveMiningRounds(),
  },
  {
    name: 'mining_rounds_search',
    description: 'Search mining rounds by round number',
    inputSchema: z.object({
      round: z.number().optional().describe('Round number to search'),
    }),
    handler: async (client, args) => client.searchMiningRounds(args),
  },
];
