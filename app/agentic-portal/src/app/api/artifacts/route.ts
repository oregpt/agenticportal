import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { createArtifactWithVersion, listArtifacts } from '@/server/artifacts';
import type { ArtifactType } from '@/server/artifacts';

function toArtifactType(input: string): ArtifactType | null {
  return ['table', 'chart', 'dashboard', 'kpi'].includes(input) ? (input as ArtifactType) : null;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user.organizationId;
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
  const rawType = request.nextUrl.searchParams.get('type');
  let type: ArtifactType | undefined = undefined;
  if (rawType) {
    const parsedType = toArtifactType(rawType);
    if (!parsedType) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    type = parsedType;
  }
  const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
  const artifacts = await listArtifacts({ organizationId, projectId, type, includeArchived });
  return NextResponse.json({ artifacts });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const organizationId = String(body.organizationId || user.organizationId);
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const projectId = String(body.projectId || '');
  const type = toArtifactType(String(body.type || ''));
  const name = String(body.name || '').trim();
  if (!projectId || !type || !name) {
    return NextResponse.json({ error: 'projectId, type, and name are required' }, { status: 400 });
  }

  const created = await createArtifactWithVersion({
    organizationId,
    projectId,
    type,
    name,
    description: body.description || null,
    querySpecId: body.querySpecId || null,
    configJson: body.configJson || null,
    layoutJson: body.layoutJson || null,
    notes: body.notes || null,
    createdBy: user.id,
  });
  return NextResponse.json(created, { status: 201 });
}
