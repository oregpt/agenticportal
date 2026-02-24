import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { runDueScheduledDeliveryChannels } from '@/server/delivery';

export async function POST(request: NextRequest) {
  const schedulerSecret = process.env.DELIVERY_SCHEDULER_SECRET;
  const token = request.headers.get('x-delivery-secret') || request.nextUrl.searchParams.get('secret');

  if (schedulerSecret && token === schedulerSecret) {
    const organizationId = request.nextUrl.searchParams.get('organizationId') || undefined;
    const limit = Number(request.nextUrl.searchParams.get('limit') || 25);
    const result = await runDueScheduledDeliveryChannels({ organizationId, limit });
    return NextResponse.json({ success: true, result });
  }

  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user.organizationId;
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limit = Number(request.nextUrl.searchParams.get('limit') || 25);
  const result = await runDueScheduledDeliveryChannels({ organizationId, limit });
  return NextResponse.json({ success: true, result });
}
