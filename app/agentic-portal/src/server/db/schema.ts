import { pgTable, text, varchar, timestamp, integer, serial, jsonb } from 'drizzle-orm/pg-core';

// ============================================================================
// AGENTIC PORTAL - Multi-Tenant & Data Visualization
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
// WORKSTREAMS (Project Container)
// ============================================================================

export const workstreams = pgTable('workstreams', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 16 }).default('#8b5cf6'), // Hex color for UI
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// LAYER 1: DATA SOURCES (Foundation)
// ============================================================================

export const dataSources = pgTable('data_sources', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  workstreamId: varchar('workstream_id', { length: 64 }), // Optional - can be unassigned
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'postgres', 'bigquery', 'google_sheets', 'csv'
  config: jsonb('config').notNull(), // Encrypted credentials
  schemaCache: jsonb('schema_cache'), // Cached table/column info
  lastSyncedAt: timestamp('last_synced_at'),
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Datasource to project assignments (many-to-many)
export const dataSourceWorkstreams = pgTable('data_source_workstreams', {
  id: serial('id').primaryKey(),
  dataSourceId: varchar('data_source_id', { length: 64 }).notNull(),
  workstreamId: varchar('workstream_id', { length: 64 }).notNull(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// LAYER 2: VIEWS (Queryable Layer)
// ============================================================================

export const views = pgTable('views', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  workstreamId: varchar('workstream_id', { length: 64 }), // Optional
  dataSourceId: varchar('data_source_id', { length: 64 }).notNull(),
  sourceTable: varchar('source_table', { length: 255 }), // The table this view queries from
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
  workstreamId: varchar('workstream_id', { length: 64 }), // Optional
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isPublic: integer('is_public').notNull().default(0),
  publicSlug: varchar('public_slug', { length: 64 }).unique(),
  layout: varchar('layout', { length: 32 }).default('grid'), // 'grid' | 'freeform'
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// LAYER 5: OUTPUTS (Export/Delivery Layer)
// ============================================================================

export const outputs = pgTable('outputs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  workstreamId: varchar('workstream_id', { length: 64 }), // Optional
  dashboardId: varchar('dashboard_id', { length: 64 }).notNull(), // Source dashboard
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'pdf', 'csv', 'email', 'webhook'
  schedule: varchar('schedule', { length: 64 }), // cron expression or 'manual'
  config: jsonb('config'), // Type-specific config (email recipients, webhook URL, etc.)
  status: varchar('status', { length: 32 }).default('active'), // 'active', 'paused', 'error'
  lastRunAt: timestamp('last_run_at'),
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

// ============================================================================
// PROJECT AGENT (Data Agent port scoped by workstream/project)
// ============================================================================

export const projectAgents = pgTable('project_agents', {
  projectId: varchar('project_id', { length: 64 }).primaryKey(), // workstream.id
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  defaultModel: varchar('default_model', { length: 128 }).notNull().default('claude-sonnet-4-20250514'),
  instructions: text('instructions'),
  features: jsonb('features'), // dataQueryRuns/dataMemoryRules/dataWorkflows/dataDeepTools/dataAnnotations/dataGlobalNotes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectAgentSourceMeta = pgTable('project_agent_source_meta', {
  sourceId: varchar('source_id', { length: 64 }).primaryKey(), // data_sources.id
  projectId: varchar('project_id', { length: 64 }).notNull(), // workstream.id
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'), // active | error | disabled
  userNotes: text('user_notes'),
  inferredNotes: text('inferred_notes'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectDataQueryRuns = pgTable('project_data_query_runs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  projectId: varchar('project_id', { length: 64 }).notNull(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  sourceId: varchar('source_id', { length: 64 }),
  workflowId: varchar('workflow_id', { length: 64 }),
  workflowRunId: varchar('workflow_run_id', { length: 64 }),
  runType: varchar('run_type', { length: 32 }).notNull().default('chat'),
  message: text('message').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('succeeded'),
  sqlText: text('sql_text'),
  rowCount: integer('row_count').notNull().default(0),
  confidence: varchar('confidence', { length: 32 }),
  reasoning: text('reasoning'),
  answer: text('answer'),
  resultSample: jsonb('result_sample'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const projectDataMemoryRules = pgTable('project_data_memory_rules', {
  id: varchar('id', { length: 64 }).primaryKey(),
  projectId: varchar('project_id', { length: 64 }).notNull(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  sourceId: varchar('source_id', { length: 64 }),
  name: varchar('name', { length: 255 }).notNull(),
  ruleText: text('rule_text').notNull(),
  enabled: integer('enabled').notNull().default(1),
  priority: integer('priority').notNull().default(100),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectDataWorkflows = pgTable('project_data_workflows', {
  id: varchar('id', { length: 64 }).primaryKey(),
  projectId: varchar('project_id', { length: 64 }).notNull(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  enabled: integer('enabled').notNull().default(1),
  definition: jsonb('definition').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectDataWorkflowRuns = pgTable('project_data_workflow_runs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  workflowId: varchar('workflow_id', { length: 64 }).notNull(),
  projectId: varchar('project_id', { length: 64 }).notNull(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('running'),
  triggeredBy: varchar('triggered_by', { length: 32 }).notNull().default('manual'),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const platformSettings = pgTable('ai_platform_settings', {
  key: varchar('key', { length: 128 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

