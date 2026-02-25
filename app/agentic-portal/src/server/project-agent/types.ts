export type ProjectAgentSourceType = 'bigquery' | 'postgres' | 'google_sheets' | 'google_sheets_live' | 'mcp_server';

export interface ProjectAgentFeatureState {
  dataQueryRuns: boolean;
  dataMemoryRules: boolean;
  dataWorkflows: boolean;
  dataDeepTools: boolean;
  dataAnnotations: boolean;
}

export type ProjectAgentFeatureKey = keyof ProjectAgentFeatureState;

export interface ProjectAgentDataSource {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  type: ProjectAgentSourceType;
  config: Record<string, unknown>;
  schemaCache?: Record<string, unknown> | null;
  status: 'active' | 'error' | 'disabled';
  userNotes: string;
  inferredNotes: string;
  lastSyncedAt: Date | null;
  updatedAt: Date;
}

export interface ProjectAgentDataSourceSchema {
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
    rowCount?: number;
  }>;
  lastRefreshed: string;
}

export interface ProjectAgentDataSourceConnectionTest {
  success: boolean;
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
  error?: string;
}
