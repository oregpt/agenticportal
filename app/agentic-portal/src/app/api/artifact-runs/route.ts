import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { listArtifactRuns } from '@/server/artifacts';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user.organizationId;
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
  const artifactId = request.nextUrl.searchParams.get('artifactId') || undefined;
  const limit = Number(request.nextUrl.searchParams.get('limit') || 50);
  const runs = await listArtifactRuns({ organizationId, projectId, artifactId, limit });
  return NextResponse.json({ runs });
}
