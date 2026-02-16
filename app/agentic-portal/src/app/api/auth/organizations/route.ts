import { NextResponse } from 'next/server';
import { getAccessibleOrganizations, getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const organizations = await getAccessibleOrganizations(user);

  return NextResponse.json({
    organizations,
    activeOrganizationId: user.organizationId,
  });
}

