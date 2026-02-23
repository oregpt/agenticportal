import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { runArtifact } from '@/server/artifacts';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const organizationId = String(body.organizationId || user.organizationId);
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const triggerType = ['chat', 'manual', 'api', 'delivery'].includes(String(body.triggerType || ''))
    ? (body.triggerType as 'chat' | 'manual' | 'api' | 'delivery')
    : 'manual';

  try {
    const result = await runArtifact({
      organizationId,
      artifactId: id,
      triggerType,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to run artifact' }, { status: 400 });
  }
}
