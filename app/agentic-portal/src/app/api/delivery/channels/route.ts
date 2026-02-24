import { NextRequest, NextResponse } from 'next/server';
import { canManageOrganization, getCurrentUser } from '@/lib/auth';
import { createDeliveryChannel, listDeliveryChannels } from '@/server/delivery';
import type { DeliveryChannelType, DeliveryFrequency, DeliveryMode } from '@/server/delivery';

function normalizeChannelType(value: string): DeliveryChannelType | null {
  if (value === 'email' || value === 'slack' || value === 'teams') return value;
  return null;
}

function normalizeDeliveryMode(value: string): DeliveryMode {
  return value === 'scheduled' ? 'scheduled' : 'on_demand';
}

function normalizeFrequency(value: string | null | undefined): DeliveryFrequency | null {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') return value;
  return null;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = request.nextUrl.searchParams.get('organizationId') || user.organizationId;
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
  const channels = await listDeliveryChannels({ organizationId, projectId });
  return NextResponse.json({ channels });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const organizationId = String(body.organizationId || user.organizationId);
  if (!canManageOrganization(user, organizationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const channelType = normalizeChannelType(String(body.channelType || ''));
  const deliveryMode = normalizeDeliveryMode(String(body.deliveryMode || 'on_demand'));

  const projectId = String(body.projectId || '').trim();
  const artifactId = String(body.artifactId || '').trim();
  const name = String(body.name || '').trim();

  if (!projectId || !artifactId || !name || !channelType) {
    return NextResponse.json(
      { error: 'projectId, artifactId, name, and channelType are required' },
      { status: 400 },
    );
  }

  const scheduleFrequency = normalizeFrequency(body.scheduleFrequency);
  const created = await createDeliveryChannel({
    organizationId,
    projectId,
    artifactId,
    name,
    channelType,
    deliveryMode,
    scheduleFrequency,
    scheduleDayOfWeek: body.scheduleDayOfWeek === undefined ? null : Number(body.scheduleDayOfWeek),
    scheduleDayOfMonth: body.scheduleDayOfMonth === undefined ? null : Number(body.scheduleDayOfMonth),
    scheduleTime: body.scheduleTime ? String(body.scheduleTime) : null,
    scheduleTimezone: body.scheduleTimezone ? String(body.scheduleTimezone) : 'UTC',
    configJson: body.configJson || null,
    isEnabled: body.isEnabled !== false,
    createdBy: user.id,
  });

  return NextResponse.json({ channel: created }, { status: 201 });
}
