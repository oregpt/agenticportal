import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { deleteDeliveryChannel, getDeliveryChannelById, updateDeliveryChannel } from '@/server/delivery';
import type { DeliveryChannelType, DeliveryFrequency, DeliveryMode } from '@/server/delivery';

function normalizeChannelType(value: string | null | undefined): DeliveryChannelType | undefined {
  if (!value) return undefined;
  if (value === 'email' || value === 'slack' || value === 'teams') return value;
  return undefined;
}

function normalizeDeliveryMode(value: string | null | undefined): DeliveryMode | undefined {
  if (!value) return undefined;
  return value === 'scheduled' ? 'scheduled' : 'on_demand';
}

function normalizeFrequency(value: string | null | undefined): DeliveryFrequency | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value === 'daily' || value === 'weekly' || value === 'monthly') return value;
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const channel = await getDeliveryChannelById({
    channelId: id,
    organizationId: user.organizationId,
  });

  if (!channel || !canManageOrganization(user, channel.organizationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ channel });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getDeliveryChannelById({
    channelId: id,
    organizationId: user.organizationId,
  });
  if (!existing || !canManageOrganization(user, existing.organizationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const patched = await updateDeliveryChannel({
    channelId: id,
    organizationId: existing.organizationId,
    patch: {
      projectId: body.projectId === undefined ? undefined : String(body.projectId || ''),
      artifactId: body.artifactId === undefined ? undefined : String(body.artifactId || ''),
      name: body.name === undefined ? undefined : String(body.name || ''),
      channelType: normalizeChannelType(body.channelType),
      deliveryMode: normalizeDeliveryMode(body.deliveryMode),
      scheduleFrequency: normalizeFrequency(body.scheduleFrequency),
      scheduleDayOfWeek: body.scheduleDayOfWeek === undefined ? undefined : Number(body.scheduleDayOfWeek),
      scheduleDayOfMonth: body.scheduleDayOfMonth === undefined ? undefined : Number(body.scheduleDayOfMonth),
      scheduleTime: body.scheduleTime === undefined ? undefined : body.scheduleTime ? String(body.scheduleTime) : null,
      scheduleTimezone:
        body.scheduleTimezone === undefined ? undefined : body.scheduleTimezone ? String(body.scheduleTimezone) : null,
      configJson: body.configJson,
      isEnabled: body.isEnabled === undefined ? undefined : Boolean(body.isEnabled),
    },
  });

  if (!patched) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ channel: patched });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getDeliveryChannelById({ channelId: id, organizationId: user.organizationId });
  if (!existing || !canManageOrganization(user, existing.organizationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const deleted = await deleteDeliveryChannel({ channelId: id, organizationId: existing.organizationId });
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
