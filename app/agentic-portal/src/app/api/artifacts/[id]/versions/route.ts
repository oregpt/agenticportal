import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { createArtifactVersion, listArtifactVersions } from '@/server/artifacts';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user.organizationId;
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const versions = await listArtifactVersions(id, organizationId);
  return NextResponse.json({ versions });
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
  const version = await createArtifactVersion({
    artifactId: id,
    querySpecId: body.querySpecId || null,
    configJson: body.configJson || null,
    layoutJson: body.layoutJson || null,
    notes: body.notes || null,
    createdBy: user.id,
  });
  return NextResponse.json({ version }, { status: 201 });
}
