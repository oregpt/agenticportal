import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createDashboardBlockFromSql } from '@/server/artifacts';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const projectId = String(body.projectId || '');
  const sourceId = String(body.sourceId || '');
  const name = String(body.name || 'KPI Tile').trim();
  const sqlText = String(body.sqlText || '').trim();
  if (!projectId || !sourceId || !sqlText) {
    return NextResponse.json({ error: 'projectId, sourceId, and sqlText are required' }, { status: 400 });
  }

  const created = await createDashboardBlockFromSql({
    organizationId: user.organizationId,
    projectId,
    sourceId,
    sqlText,
    name,
    artifactType: 'kpi',
    description: body.description || 'KPI tile created from project agent output',
    metadataJson: body.metadataJson || null,
    configJson: body.configJson || null,
    displayJson: body.displayJson || null,
    positionJson: body.positionJson || null,
    dashboardArtifactId: body.dashboardArtifactId || undefined,
    createdBy: user.id,
  });

  return NextResponse.json(
    {
      querySpec: created.querySpec,
      artifact: created.artifact,
      version: created.version,
      dashboardArtifactId: created.dashboard.id,
      dashboardItem: created.dashboardItem,
    },
    { status: 201 }
  );
}
