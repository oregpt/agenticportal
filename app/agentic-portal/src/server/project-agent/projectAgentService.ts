import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { ProjectAgentFeatureKey, ProjectAgentFeatureState } from './types';
import { ensureProjectAgentTables } from './bootstrap';

const DEFAULT_FEATURES: ProjectAgentFeatureState = {
  dataQueryRuns: true,
  dataMemoryRules: true,
  dataWorkflows: true,
  dataDeepTools: true,
  dataAnnotations: true,
};

export function isProjectAgentModuleEnabled(): boolean {
  return process.env.FEATURE_PROJECT_AGENT_MODULE !== 'false';
}

export function resolveProjectAgentFeatures(agent: { features?: Record<string, unknown> | null }): ProjectAgentFeatureState {
  const features = (agent.features || {}) as Record<string, unknown>;
  return {
    dataQueryRuns: features.dataQueryRuns !== false,
    dataMemoryRules: features.dataMemoryRules !== false,
    dataWorkflows: features.dataWorkflows !== false,
    dataDeepTools: features.dataDeepTools !== false,
    dataAnnotations: features.dataAnnotations !== false,
  };
}

export async function assertProjectAgent(projectId: string, organizationId: string) {
  await ensureProjectAgentTables();

  const [project] = await db
    .select()
    .from(schema.workstreams)
    .where(and(eq(schema.workstreams.id, projectId), eq(schema.workstreams.organizationId, organizationId)))
    .limit(1);

  if (!project) throw new Error('Project not found');

  const [agent] = await db
    .select()
    .from(schema.projectAgents)
    .where(and(eq(schema.projectAgents.projectId, projectId), eq(schema.projectAgents.organizationId, organizationId)))
    .limit(1);

  if (agent) return agent;

  const now = new Date();
  const [created] = await db
    .insert(schema.projectAgents)
    .values({
      projectId,
      organizationId,
      defaultModel: 'claude-sonnet-4-20250514',
      features: DEFAULT_FEATURES,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function listProjectAgents(organizationId: string) {
  await ensureProjectAgentTables();
  const projects = await db
    .select({
      id: schema.workstreams.id,
      name: schema.workstreams.name,
      description: schema.workstreams.description,
      updatedAt: schema.workstreams.updatedAt,
    })
    .from(schema.workstreams)
    .where(eq(schema.workstreams.organizationId, organizationId));

  return projects;
}

export async function getProjectAgentFeatures(projectId: string, organizationId: string): Promise<ProjectAgentFeatureState> {
  const agent = await assertProjectAgent(projectId, organizationId);
  return resolveProjectAgentFeatures(agent as { features?: Record<string, unknown> | null });
}

export async function isProjectFeatureEnabled(
  projectId: string,
  organizationId: string,
  key: ProjectAgentFeatureKey
): Promise<boolean> {
  const features = await getProjectAgentFeatures(projectId, organizationId);
  return features[key];
}

export async function updateProjectAgentFeatures(
  projectId: string,
  organizationId: string,
  patch: Partial<ProjectAgentFeatureState>
): Promise<ProjectAgentFeatureState> {
  const agent = await assertProjectAgent(projectId, organizationId);
  const current = resolveProjectAgentFeatures(agent as { features?: Record<string, unknown> | null });
  const next = { ...current, ...patch };
  const mergedFeatures = {
    ...((agent.features || {}) as Record<string, unknown>),
    ...next,
  };
  await db
    .update(schema.projectAgents)
    .set({ features: mergedFeatures, updatedAt: new Date() })
    .where(and(eq(schema.projectAgents.projectId, projectId), eq(schema.projectAgents.organizationId, organizationId)));
  return next;
}

export async function getProjectAgentGlobalNotes(projectId: string, organizationId: string): Promise<string> {
  const agent = await assertProjectAgent(projectId, organizationId);
  const features = (agent.features || {}) as Record<string, unknown>;
  return typeof features.dataGlobalNotes === 'string' ? features.dataGlobalNotes : '';
}

export async function updateProjectAgentGlobalNotes(
  projectId: string,
  organizationId: string,
  globalNotes: string
): Promise<string> {
  const agent = await assertProjectAgent(projectId, organizationId);
  const mergedFeatures = {
    ...((agent.features || {}) as Record<string, unknown>),
    dataGlobalNotes: globalNotes || '',
  };
  await db
    .update(schema.projectAgents)
    .set({ features: mergedFeatures, updatedAt: new Date() })
    .where(and(eq(schema.projectAgents.projectId, projectId), eq(schema.projectAgents.organizationId, organizationId)));
  return globalNotes || '';
}
