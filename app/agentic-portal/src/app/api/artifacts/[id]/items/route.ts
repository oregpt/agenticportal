import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { addDashboardItem, listDashboardItems } from '@/server/artifacts';

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
  if (!childArtifactId) return NextResponse.json({ error: 'childArtifactId is required' }, { status: 400 });
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
