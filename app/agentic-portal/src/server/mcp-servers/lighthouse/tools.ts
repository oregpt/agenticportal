import { z } from 'zod';
import { LighthouseClient } from './api-client';

interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  handler: (client: LighthouseClient, args: any) => Promise<any>;
}

export const tools: ToolDef[] = [
  {
    name: 'stats_get',
    description: 'Get Canton network aggregate statistics',
    inputSchema: z.object({}),
    handler: async (client) => client.getStats(),
  },
  {
    name: 'validators_list',
    description: 'List Canton validators',
    inputSchema: z.object({}),
    handler: async (client) => client.listValidators(),
  },
  {
    name: 'validator_get',
    description: 'Get validator details by ID',
    inputSchema: z.object({
      id: z.string().describe('Validator ID'),
    }),
    handler: async (client, args) => client.getValidator(args.id),
  },
  {
    name: 'governance_list',
    description: 'List governance vote requests',
    inputSchema: z.object({}),
    handler: async (client) => client.listGovernance(),
  },
  {
    name: 'governance_stats',
    description: 'Get governance statistics',
    inputSchema: z.object({}),
    handler: async (client) => client.getGovernanceStats(),
  },
  {
    name: 'transactions_list',
    description: 'List ledger transactions',
    inputSchema: z.object({
      limit: z.number().optional().describe('Max results'),
      cursor: z.string().optional().describe('Pagination cursor'),
      direction: z.string().optional().describe('Sort direction (asc/desc)'),
    }),
    handler: async (client, args) => client.listTransactions(args.limit, args.cursor, args.direction),
  },
  {
    name: 'transaction_get',
    description: 'Get transaction by update ID',
    inputSchema: z.object({
      updateId: z.string().describe('Transaction update ID'),
    }),
    handler: async (client, args) => client.getTransaction(args.updateId),
  },
  {
    name: 'transfers_list',
    description: 'List token transfers',
    inputSchema: z.object({
      time_start: z.string().optional().describe('Start time (RFC3339)'),
      time_end: z.string().optional().describe('End time (RFC3339)'),
      limit: z.number().optional().describe('Max results'),
      cursor: z.number().optional().describe('Pagination cursor'),
      direction: z.string().optional().describe('Sort direction (asc/desc)'),
    }),
    handler: async (client, args) =>
      client.listTransfers(args.time_start, args.time_end, args.limit, args.cursor, args.direction),
  },
  {
    name: 'price_get',
    description: 'Get latest Canton Coin price',
    inputSchema: z.object({}),
    handler: async (client) => client.getPrice(),
  },
  {
    name: 'search',
    description: 'Search validators, parties, contracts, and domains',
    inputSchema: z.object({
      q: z.string().describe('Search query'),
    }),
    handler: async (client, args) => client.search(args.q),
  },
];
