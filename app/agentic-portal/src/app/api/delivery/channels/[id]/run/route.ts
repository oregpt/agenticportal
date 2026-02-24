import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { getDeliveryChannelById, runDeliveryChannelNow } from '@/server/delivery';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const channel = await getDeliveryChannelById({ channelId: id, organizationId: user.organizationId });
  if (!channel || !canManageOrganization(user, channel.organizationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await runDeliveryChannelNow({
      organizationId: channel.organizationId,
      channelId: channel.id,
      triggerType: 'manual',
    });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to run delivery channel' },
      { status: 500 },
    );
  }
}
