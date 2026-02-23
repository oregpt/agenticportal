import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { removeDashboardItem, updateDashboardItem } from '@/server/artifacts';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, itemId } = await context.params;
  const body = await request.json();
  const organizationId = String(body.organizationId || user.organizationId);
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const item = await updateDashboardItem({
    organizationId,
    dashboardArtifactId: id,
    itemId,
    childArtifactVersionId: body.childArtifactVersionId,
    positionJson: body.positionJson,
    displayJson: body.displayJson,
  });
  return NextResponse.json({ item });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, itemId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const organizationId = String(body.organizationId || user.organizationId);
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const result = await removeDashboardItem({ organizationId, dashboardArtifactId: id, itemId });
  return NextResponse.json(result);
}
