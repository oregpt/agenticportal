export type ArtifactType = 'table' | 'chart' | 'dashboard' | 'kpi';
export type ArtifactStatus = 'active' | 'archived';
export type ArtifactRunStatus = 'running' | 'succeeded' | 'failed';
export type ArtifactRunTrigger = 'chat' | 'manual' | 'api' | 'delivery';

export interface QuerySpecInput {
  organizationId: string;
  projectId: string;
  sourceId: string;
  name: string;
  sqlText: string;
  parametersJson?: Record<string, unknown> | null;
  metadataJson?: Record<string, unknown> | null;
  createdBy?: string | null;
}

export interface ArtifactInput {
  organizationId: string;
  projectId: string;
  type: ArtifactType;
  name: string;
  description?: string | null;
  createdBy?: string | null;
}

export interface ArtifactVersionInput {
  artifactId: string;
  querySpecId?: string | null;
  configJson?: Record<string, unknown> | null;
  layoutJson?: Record<string, unknown> | null;
  notes?: string | null;
  createdBy?: string | null;
}
