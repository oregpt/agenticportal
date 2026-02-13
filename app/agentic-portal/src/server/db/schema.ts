/**
 * Agent Hub Database Schema — PostgreSQL + pgvector
 *
 * Tables: agents, conversations, messages, capabilities, agentCapabilities,
 * capabilityTokens, agentDocuments, agentMemoryEmbeddings, agentApiKeys,
 * documents, documentChunks (RAG/KB support).
 */

import { pgTable, text, varchar, timestamp, integer, serial, jsonb, customType } from 'drizzle-orm/pg-core';

// Custom type for pgvector — stores as vector but accepts/returns number[]
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)'; // OpenAI text-embedding-3-small dimension
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    const cleaned = value.replace(/^\[|\]$/g, '');
    return cleaned ? cleaned.split(',').map(Number) : [];
  },
});

// ============================================================================
// Core Tables
// ============================================================================

export const agents = pgTable('ai_agents', {
  id: varchar('id', { length: 64 }).primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  instructions: text('instructions'),
  defaultModel: varchar('default_model', { length: 128 }).notNull(),
  adminKey: varchar('admin_key', { length: 128 }), // Per-agent admin key (scoped access)
  branding: jsonb('branding'), // Theme settings
  features: jsonb('features'), // Feature overrides: { soulMemory?: bool, deepTools?: bool }
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// Knowledge Base (RAG)
// ============================================================================

export const documents = pgTable('ai_documents', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  sourceType: varchar('source_type', { length: 32 }).notNull(),
  mimeType: varchar('mime_type', { length: 128 }),
  size: integer('size'),
  storagePath: varchar('storage_path', { length: 512 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documentChunks = pgTable('ai_document_chunks', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  tokenCount: integer('token_count'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(), // UUID for public API
  sessionToken: varchar('session_token', { length: 128 }).notNull(), // Required for all chat ops
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  externalUserId: varchar('external_user_id', { length: 255 }),
  title: varchar('title', { length: 255 }),
  sessionSummary: text('session_summary'),
  messageCount: integer('message_count').default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  role: varchar('role', { length: 16 }).notNull(), // user | assistant | system
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// Capabilities (MCP Servers)
// ============================================================================

export const capabilities = pgTable('ai_capabilities', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 32 }).notNull(), // 'mcp'
  category: varchar('category', { length: 64 }),
  config: jsonb('config'),
  enabled: integer('enabled').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agentCapabilities = pgTable('ai_agent_capabilities', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  capabilityId: varchar('capability_id', { length: 64 }).notNull(),
  enabled: integer('enabled').notNull().default(1),
  config: jsonb('config'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const capabilityTokens = pgTable('ai_capability_tokens', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  capabilityId: varchar('capability_id', { length: 64 }).notNull(),
  token1: text('token1'),
  token2: text('token2'),
  token3: text('token3'),
  token4: text('token4'),
  token5: text('token5'),
  iv: varchar('iv', { length: 32 }),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// Soul & Memory System
// ============================================================================

export const agentDocuments = pgTable('ai_agent_documents', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  docType: varchar('doc_type', { length: 50 }).notNull(), // 'soul', 'memory', 'context'
  docKey: varchar('doc_key', { length: 255 }).notNull(),   // e.g., 'soul.md', 'memory.md'
  content: text('content').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const agentMemoryEmbeddings = pgTable('ai_agent_memory_embeddings', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  docId: integer('doc_id').notNull(),
  chunkText: text('chunk_text').notNull(),
  embedding: vector('embedding'),
  lineStart: integer('line_start'),
  lineEnd: integer('line_end'),
  contentHash: varchar('content_hash', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// Per-Agent API Keys
// ============================================================================

export const agentApiKeys = pgTable('ai_agent_api_keys', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  key: varchar('key', { length: 64 }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  iv: varchar('iv', { length: 32 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// AGENTIC PORTAL — Multi-Tenant & Data Visualization
// ============================================================================

// Organizations (multi-tenant)
export const organizations = pgTable('organizations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Users (linked to external auth like Supabase/Clerk)
export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(), // External auth ID
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  organizationId: varchar('organization_id', { length: 64 }),
  role: varchar('role', { length: 32 }).notNull().default('member'), // 'owner', 'admin', 'member', 'viewer'
  isPlatformAdmin: integer('is_platform_admin').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// LAYER 1: DATA SOURCES (Foundation)
// ============================================================================

export const dataSources = pgTable('data_sources', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'postgres', 'bigquery', 'google_sheets', 'csv'
  config: jsonb('config').notNull(), // Encrypted credentials
  schemaCache: jsonb('schema_cache'), // Cached table/column info
  lastSyncedAt: timestamp('last_synced_at'),
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// LAYER 2: VIEWS (Queryable Layer)
// ============================================================================

export const views = pgTable('views', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  dataSourceId: varchar('data_source_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sql: text('sql').notNull(),
  naturalLanguageQuery: text('natural_language_query'), // The NL that generated this
  columns: jsonb('columns').notNull(), // Discovered schema
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Saved Reports (parameterized views)
export const savedReports = pgTable('saved_reports', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  viewId: varchar('view_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  parameters: jsonb('parameters'), // { name, type, label, defaultValue }[]
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// LAYER 3: WIDGETS & DASHBOARDS (Display Layer)
// ============================================================================

export const dashboards = pgTable('dashboards', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isPublic: integer('is_public').notNull().default(0),
  publicSlug: varchar('public_slug', { length: 64 }).unique(),
  layout: varchar('layout', { length: 32 }).default('grid'), // 'grid' | 'freeform'
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const widgets = pgTable('widgets', {
  id: varchar('id', { length: 64 }).primaryKey(),
  dashboardId: varchar('dashboard_id', { length: 64 }).notNull(),
  viewId: varchar('view_id', { length: 64 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'table', 'bar', 'line', 'pie', 'metric', etc.
  title: varchar('title', { length: 255 }),
  position: jsonb('position').notNull(), // { x, y, width, height }
  config: jsonb('config').notNull(), // Visualization config
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// LAYER 4: AI CHAT SESSIONS (Portal-specific)
// ============================================================================

export const chatSessions = pgTable('chat_sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  dataSourceId: varchar('data_source_id', { length: 64 }), // Optional - can query across sources
  title: varchar('title', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  role: varchar('role', { length: 16 }).notNull(), // 'user', 'assistant', 'system'
  content: text('content').notNull(),
  sql: text('sql'), // If the message resulted in a query
  viewId: varchar('view_id', { length: 64 }), // If saved as a view
  data: jsonb('data'), // Query results
  suggestedChartType: varchar('suggested_chart_type', { length: 32 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
