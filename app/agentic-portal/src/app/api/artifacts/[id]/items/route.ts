import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { addDashboardItem, createDashboardBlockFromSql, getArtifactById, listDashboardItems } from '@/server/artifacts';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user.organizationId;
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const items = await listDashboardItems(id);
  return NextResponse.json({ items });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const organizationId = String(body.organizationId || user.organizationId);
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const childArtifactId = String(body.childArtifactId || '');

  // Existing artifact path
  if (childArtifactId) {
    const item = await addDashboardItem({
      organizationId,
      dashboardArtifactId: id,
      childArtifactId,
      childArtifactVersionId: body.childArtifactVersionId || null,
      positionJson: body.positionJson || null,
      displayJson: body.displayJson || null,
    });
    return NextResponse.json({ item }, { status: 201 });
  }

  // Direct-create path (unified with agent-created blocks)
  const dashboard = await getArtifactById(id, organizationId);
  if (!dashboard?.artifact || dashboard.artifact.type !== 'dashboard') {
    return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
  }

  const sourceId = String(body.sourceId || '');
  const sqlText = String(body.sqlText || '').trim();
  const name = String(body.name || '').trim();
  const artifactType = String(body.artifactType || '').trim() as 'table' | 'chart' | 'kpi';

  if (!sourceId || !sqlText || !name || !['table', 'chart', 'kpi'].includes(artifactType)) {
    return NextResponse.json(
      { error: 'For direct create: sourceId, sqlText, name, and artifactType (table|chart|kpi) are required' },
      { status: 400 }
    );
  }

  const created = await createDashboardBlockFromSql({
    organizationId,
    projectId: dashboard.artifact.projectId,
    dashboardArtifactId: id,
    sourceId,
    sqlText,
    name,
    artifactType,
    description: body.description || null,
    metadataJson: body.metadataJson || null,
    configJson: body.configJson || null,
    displayJson: body.displayJson || null,
    positionJson: body.positionJson || null,
    createdBy: user.id,
  });

  return NextResponse.json(
    {
      item: created.dashboardItem,
      artifact: created.artifact,
      version: created.version,
      querySpec: created.querySpec,
    },
    { status: 201 }
  );
}
