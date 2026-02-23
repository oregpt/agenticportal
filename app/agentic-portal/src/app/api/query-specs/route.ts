import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { createQuerySpec, listQuerySpecs } from '@/server/artifacts';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user.organizationId;
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
  const sourceId = request.nextUrl.searchParams.get('sourceId') || undefined;
  const specs = await listQuerySpecs({ organizationId, projectId, sourceId });
  return NextResponse.json({ querySpecs: specs });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const organizationId = String(body.organizationId || user.organizationId);
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const projectId = String(body.projectId || '');
  const sourceId = String(body.sourceId || '');
  const name = String(body.name || '').trim();
  const sqlText = String(body.sqlText || '').trim();
  if (!projectId || !sourceId || !name || !sqlText) {
    return NextResponse.json({ error: 'projectId, sourceId, name, and sqlText are required' }, { status: 400 });
  }
  const spec = await createQuerySpec({
    organizationId,
    projectId,
    sourceId,
    name,
    sqlText,
    parametersJson: body.parametersJson || null,
    metadataJson: body.metadataJson || null,
    createdBy: user.id,
  });
  return NextResponse.json({ querySpec: spec }, { status: 201 });
}
