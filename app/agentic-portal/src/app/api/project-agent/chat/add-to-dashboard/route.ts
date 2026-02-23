import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { addDashboardItem, createArtifactWithVersion, createQuerySpec, listArtifacts } from '@/server/artifacts';

async function getOrCreateDashboard(input: { organizationId: string; projectId: string; createdBy: string }) {
  const dashboards = await listArtifacts({
    organizationId: input.organizationId,
    projectId: input.projectId,
    type: 'dashboard',
  });
  if (dashboards.length > 0) return dashboards[0]!;

  const created = await createArtifactWithVersion({
    organizationId: input.organizationId,
    projectId: input.projectId,
    type: 'dashboard',
    name: 'Default Dashboard',
    description: 'Auto-created dashboard for project artifacts',
    configJson: { mode: 'grid' },
    layoutJson: { columns: 12 },
    createdBy: input.createdBy,
  });
  return created.artifact;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const projectId = String(body.projectId || '');
  const sourceId = String(body.sourceId || '');
  const sqlText = String(body.sqlText || '').trim();
  if (!projectId || !sourceId || !sqlText) {
    return NextResponse.json({ error: 'projectId, sourceId, and sqlText are required' }, { status: 400 });
  }

  const baseName = String(body.name || 'Chat Result').trim();
  const chartName = `${baseName} Chart`;
  const querySpec = await createQuerySpec({
    organizationId: user.organizationId,
    projectId,
    sourceId,
    name: `${baseName} Query`,
    sqlText,
    metadataJson: body.metadataJson || null,
    createdBy: user.id,
  });

  const chart = await createArtifactWithVersion({
    organizationId: user.organizationId,
    projectId,
    type: 'chart',
    name: chartName,
    description: 'Created from project agent chat',
    querySpecId: querySpec.id,
    configJson: body.configJson || { chartType: 'bar' },
    createdBy: user.id,
  });

  const dashboardArtifactId = String(body.dashboardArtifactId || '');
  const dashboard = dashboardArtifactId
    ? { id: dashboardArtifactId }
    : await getOrCreateDashboard({
        organizationId: user.organizationId,
        projectId,
        createdBy: user.id,
      });

  const item = await addDashboardItem({
    organizationId: user.organizationId,
    dashboardArtifactId: dashboard.id,
    childArtifactId: chart.artifact.id,
    childArtifactVersionId: chart.version.id,
    positionJson: body.positionJson || null,
    displayJson: body.displayJson || null,
  });

  return NextResponse.json(
    {
      querySpec,
      chartArtifact: chart.artifact,
      chartVersion: chart.version,
      dashboardArtifactId: dashboard.id,
      dashboardItem: item,
    },
    { status: 201 }
  );
}
