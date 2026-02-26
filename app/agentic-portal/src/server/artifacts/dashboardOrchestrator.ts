import { addDashboardItem } from './dashboardService';
import { createQuerySpec } from './querySpecService';
import { createArtifactWithVersion, listArtifacts, listDashboardItems } from './artifactService';
import { runArtifact } from './runService';
import {
  buildDeterministicArtifactConfig,
  defaultDashboardDisplay,
  defaultDashboardPosition,
  type DeterministicArtifactType,
} from './registry';

async function getOrCreateProjectDashboard(input: {
  organizationId: string;
  projectId: string;
  createdBy: string;
  dashboardArtifactId?: string;
}) {
  if (input.dashboardArtifactId) {
    return { id: input.dashboardArtifactId, name: 'Dashboard' };
  }

  const dashboards = await listArtifacts({
    organizationId: input.organizationId,
    projectId: input.projectId,
    type: 'dashboard',
  });

  if (dashboards.length) {
    return dashboards[0]!;
  }

  const created = await createArtifactWithVersion({
    organizationId: input.organizationId,
    projectId: input.projectId,
    type: 'dashboard',
    name: 'Project Dashboard',
    description: 'Primary home for project agent outputs.',
    configJson: { mode: 'grid' },
    layoutJson: { columns: 12 },
    createdBy: input.createdBy,
  });

  return created.artifact;
}

export async function createDashboardBlockFromSql(input: {
  organizationId: string;
  projectId: string;
  sourceId: string;
  sqlText: string;
  name: string;
  artifactType: DeterministicArtifactType;
  metadataJson?: Record<string, unknown> | null;
  description?: string | null;
  configJson?: Record<string, unknown> | null;
  displayJson?: Record<string, unknown> | null;
  positionJson?: Record<string, unknown> | null;
  dashboardArtifactId?: string;
  createdBy: string;
}) {
  const querySpec = await createQuerySpec({
    organizationId: input.organizationId,
    projectId: input.projectId,
    sourceId: input.sourceId,
    name: `${input.name} Query`,
    sqlText: input.sqlText,
    metadataJson: input.metadataJson || null,
    createdBy: input.createdBy,
  });

  const configJson = buildDeterministicArtifactConfig({
    artifactType: input.artifactType,
    metadataJson: input.metadataJson,
    overrideConfig: input.configJson,
  });

  const created = await createArtifactWithVersion({
    organizationId: input.organizationId,
    projectId: input.projectId,
    type: input.artifactType,
    name: input.name,
    description: input.description || null,
    querySpecId: querySpec.id,
    configJson,
    createdBy: input.createdBy,
  });

  const dashboard = await getOrCreateProjectDashboard({
    organizationId: input.organizationId,
    projectId: input.projectId,
    createdBy: input.createdBy,
    dashboardArtifactId: input.dashboardArtifactId,
  });

  const existingItems = await listDashboardItems(dashboard.id);
  const item = await addDashboardItem({
    organizationId: input.organizationId,
    dashboardArtifactId: dashboard.id,
    childArtifactId: created.artifact.id,
    childArtifactVersionId: created.version.id,
    positionJson:
      input.positionJson ||
      defaultDashboardPosition({
        artifactType: input.artifactType,
        existingItemCount: existingItems.length,
      }),
    displayJson:
      input.displayJson ||
      defaultDashboardDisplay({
        artifactType: input.artifactType,
        title: input.name,
      }),
  });

  // Persist an initial data snapshot at creation time so artifacts are not "schema-only".
  const initialRunResult = await runArtifact({
    organizationId: input.organizationId,
    artifactId: created.artifact.id,
    triggerType: 'chat',
  });

  return {
    querySpec,
    artifact: created.artifact,
    version: created.version,
    dashboard,
    dashboardItem: item,
    initialRun: initialRunResult.run,
  };
}
