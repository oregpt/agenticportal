import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createArtifactWithVersion, createQuerySpec } from '@/server/artifacts';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const projectId = String(body.projectId || '');
  const sourceId = String(body.sourceId || '');
  const name = String(body.name || 'New Chart').trim();
  const sqlText = String(body.sqlText || '').trim();
  if (!projectId || !sourceId || !sqlText) {
    return NextResponse.json({ error: 'projectId, sourceId, and sqlText are required' }, { status: 400 });
  }

  const querySpec = await createQuerySpec({
    organizationId: user.organizationId,
    projectId,
    sourceId,
    name: `${name} Query`,
    sqlText,
    metadataJson: body.metadataJson || null,
    createdBy: user.id,
  });

  const created = await createArtifactWithVersion({
    organizationId: user.organizationId,
    projectId,
    type: 'chart',
    name,
    description: body.description || null,
    querySpecId: querySpec.id,
    configJson: body.configJson || {
      chartType: 'bar',
      xField: null,
      yField: null,
      seriesField: null,
    },
    createdBy: user.id,
  });

  return NextResponse.json({ querySpec, ...created }, { status: 201 });
}
