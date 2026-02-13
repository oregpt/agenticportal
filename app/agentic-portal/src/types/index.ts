/**
 * Core Application Types
 *
 * Types for the 4-layer architecture:
 * Layer 1: Data Sources (see lib/datasources/types.ts)
 * Layer 2: Views
 * Layer 3: Widgets
 * Layer 4: AI Chat
 */

// Re-export data source types
export * from '@/lib/datasources/types';

// =============================================================================
// LAYER 2: VIEWS
// =============================================================================

export interface View {
  id: string;
  organizationId: string;
  dataSourceId: string;
  name: string;
  description?: string;

  // Query definition
  sql: string;
  naturalLanguageQuery?: string; // The NL that generated this SQL

  // Discovered schema (cached)
  columns: ViewColumn[];

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewColumn {
  name: string;
  type: string;
  displayName?: string;
  format?: 'default' | 'currency' | 'percent' | 'number' | 'date' | 'datetime';
  visible?: boolean;
}

export interface SavedReport {
  id: string;
  organizationId: string;
  viewId: string;
  name: string;
  description?: string;

  // For parameterized queries
  parameters?: ReportParameter[];

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'daterange' | 'select';
  label: string;
  defaultValue?: string;
  options?: string[]; // For select type
  required?: boolean;
}

// =============================================================================
// LAYER 3: WIDGETS
// =============================================================================

export type WidgetType =
  | 'table'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'metric'
  | 'pivot';

export interface Widget {
  id: string;
  dashboardId: string;
  viewId: string;
  type: WidgetType;
  title: string;

  // Layout
  position: WidgetPosition;

  // Visualization config
  config: WidgetConfig;

  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetConfig {
  // For charts
  xField?: string;
  yFields?: YFieldConfig[];
  colorField?: string;

  // For tables
  visibleColumns?: string[];
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  pageSize?: number;

  // For metrics
  valueField?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  comparisonField?: string;
  format?: 'number' | 'currency' | 'percent';

  // Chart styling
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
  stacked?: boolean;
}

export interface YFieldConfig {
  field: string;
  label?: string;
  color?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

// =============================================================================
// DASHBOARDS
// =============================================================================

export interface Dashboard {
  id: string;
  organizationId: string;
  name: string;
  description?: string;

  // Sharing
  isPublic: boolean;
  publicSlug?: string;

  // Layout
  layout?: 'grid' | 'freeform';

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// LAYER 4: AI CHAT
// =============================================================================

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;

  // If the message resulted in a query
  sql?: string;
  viewId?: string; // If saved as a view

  // Results (for display)
  data?: Record<string, unknown>[];
  suggestedChartType?: WidgetType;

  createdAt: Date;
}

export interface ChatSession {
  id: string;
  organizationId: string;
  userId: string;
  dataSourceId?: string; // Optional - can query across sources

  messages: ChatMessage[];

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// ORGANIZATIONS & USERS
// =============================================================================

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  organizationId?: string;
  role: UserRole;
  isPlatformAdmin: boolean;
  createdAt: Date;
}
