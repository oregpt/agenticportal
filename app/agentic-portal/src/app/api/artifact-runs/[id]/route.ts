import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { getArtifactRunById } from '@/server/artifacts';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user.organizationId;
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const run = await getArtifactRunById(id, organizationId);
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ run });
}
