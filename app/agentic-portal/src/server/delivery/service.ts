import { and, asc, eq, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, schema } from '@/lib/db';
import { ensureProjectAgentTables } from '@/server/project-agent/bootstrap';
import { getArtifactById, runArtifact } from '@/server/artifacts';

export type DeliveryChannelType = 'email' | 'slack' | 'teams';
export type DeliveryMode = 'on_demand' | 'scheduled';
export type DeliveryFrequency = 'daily' | 'weekly' | 'monthly';
export type DeliveryTrigger = 'manual' | 'scheduled' | 'api';

type DeliveryConfig = {
  email?: {
    recipients?: string[];
    subject?: string;
    includeCsvAttachment?: boolean;
  };
  slack?: {
    webhookUrl?: string;
    botToken?: string;
    channel?: string;
  };
  teams?: {
    webhookUrl?: string;
  };
  messageTemplate?: string;
};

type ChannelInput = {
  organizationId: string;
  projectId: string;
  artifactId: string;
  name: string;
  channelType: DeliveryChannelType;
  deliveryMode: DeliveryMode;
  scheduleFrequency?: DeliveryFrequency | null;
  scheduleDayOfWeek?: number | null;
  scheduleDayOfMonth?: number | null;
  scheduleTime?: string | null;
  scheduleTimezone?: string | null;
  configJson?: DeliveryConfig | null;
  isEnabled?: boolean;
  createdBy?: string | null;
};

export async function listDeliveryChannels(input: {
  organizationId: string;
  projectId?: string;
}) {
  await ensureProjectAgentTables();
  const clauses = [eq(schema.deliveryChannels.organizationId, input.organizationId)];
  if (input.projectId) clauses.push(eq(schema.deliveryChannels.projectId, input.projectId));

  return db
    .select()
    .from(schema.deliveryChannels)
    .where(and(...clauses))
    .orderBy(asc(schema.deliveryChannels.channelType), asc(schema.deliveryChannels.name));
}

export async function createDeliveryChannel(input: ChannelInput) {
  await ensureProjectAgentTables();
  const now = new Date();
  const nextRunAt = calculateNextRunAt({
    deliveryMode: input.deliveryMode,
    scheduleFrequency: input.scheduleFrequency || null,
    scheduleDayOfWeek: input.scheduleDayOfWeek ?? null,
    scheduleDayOfMonth: input.scheduleDayOfMonth ?? null,
    scheduleTime: input.scheduleTime || null,
    fromDate: now,
  });

  const [row] = await db
    .insert(schema.deliveryChannels)
    .values({
      id: randomUUID(),
      organizationId: input.organizationId,
      projectId: input.projectId,
      artifactId: input.artifactId,
      name: input.name,
      channelType: input.channelType,
      deliveryMode: input.deliveryMode,
      scheduleFrequency: input.scheduleFrequency || null,
      scheduleDayOfWeek: input.scheduleDayOfWeek ?? null,
      scheduleDayOfMonth: input.scheduleDayOfMonth ?? null,
      scheduleTime: input.scheduleTime || null,
      scheduleTimezone: input.scheduleTimezone || 'UTC',
      configJson: sanitizeDeliveryConfig(input.configJson || null),
      isEnabled: input.isEnabled === false ? 0 : 1,
      nextRunAt,
      createdBy: input.createdBy || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

export async function getDeliveryChannelById(input: {
  channelId: string;
  organizationId: string;
}) {
  await ensureProjectAgentTables();
  const [row] = await db
    .select()
    .from(schema.deliveryChannels)
    .where(
      and(
        eq(schema.deliveryChannels.id, input.channelId),
        eq(schema.deliveryChannels.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  return row || null;
}

export async function updateDeliveryChannel(input: {
  channelId: string;
  organizationId: string;
  patch: Partial<ChannelInput>;
}) {
  await ensureProjectAgentTables();
  const existing = await getDeliveryChannelById({
    channelId: input.channelId,
    organizationId: input.organizationId,
  });
  if (!existing) return null;

  const nextDeliveryMode = (input.patch.deliveryMode || existing.deliveryMode) as DeliveryMode;
  const nextScheduleFrequency =
    (input.patch.scheduleFrequency ?? (existing.scheduleFrequency as DeliveryFrequency | null)) || null;
  const nextScheduleDayOfWeek =
    input.patch.scheduleDayOfWeek === undefined
      ? (existing.scheduleDayOfWeek as number | null)
      : input.patch.scheduleDayOfWeek;
  const nextScheduleDayOfMonth =
    input.patch.scheduleDayOfMonth === undefined
      ? (existing.scheduleDayOfMonth as number | null)
      : input.patch.scheduleDayOfMonth;
  const nextScheduleTime =
    input.patch.scheduleTime === undefined
      ? (existing.scheduleTime as string | null)
      : input.patch.scheduleTime;

  const nextRunAt = calculateNextRunAt({
    deliveryMode: nextDeliveryMode,
    scheduleFrequency: nextScheduleFrequency,
    scheduleDayOfWeek: nextScheduleDayOfWeek,
    scheduleDayOfMonth: nextScheduleDayOfMonth,
    scheduleTime: nextScheduleTime,
    fromDate: new Date(),
  });

  const [row] = await db
    .update(schema.deliveryChannels)
    .set({
      projectId: input.patch.projectId ?? existing.projectId,
      artifactId: input.patch.artifactId ?? existing.artifactId,
      name: input.patch.name ?? existing.name,
      channelType: (input.patch.channelType as DeliveryChannelType | undefined) ??
        (existing.channelType as DeliveryChannelType),
      deliveryMode: nextDeliveryMode,
      scheduleFrequency: nextScheduleFrequency,
      scheduleDayOfWeek: nextScheduleDayOfWeek,
      scheduleDayOfMonth: nextScheduleDayOfMonth,
      scheduleTime: nextScheduleTime,
      scheduleTimezone: input.patch.scheduleTimezone ?? existing.scheduleTimezone,
      configJson:
        input.patch.configJson === undefined
          ? (existing.configJson as Record<string, unknown> | null)
          : sanitizeDeliveryConfig(input.patch.configJson || null),
      isEnabled:
        input.patch.isEnabled === undefined
          ? existing.isEnabled
          : input.patch.isEnabled
            ? 1
            : 0,
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.deliveryChannels.id, existing.id))
    .returning();

  return row;
}

export async function deleteDeliveryChannel(input: {
  channelId: string;
  organizationId: string;
}) {
  await ensureProjectAgentTables();
  const existing = await getDeliveryChannelById(input);
  if (!existing) return null;

  await db.delete(schema.deliveryRuns).where(eq(schema.deliveryRuns.channelId, existing.id));
  await db.delete(schema.deliveryChannels).where(eq(schema.deliveryChannels.id, existing.id));
  return { id: existing.id };
}

async function createDeliveryRun(input: {
  channelId: string;
  organizationId: string;
  projectId: string;
  artifactId: string;
  triggerType: DeliveryTrigger;
}) {
  const [row] = await db
    .insert(schema.deliveryRuns)
    .values({
      id: randomUUID(),
      channelId: input.channelId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      artifactId: input.artifactId,
      triggerType: input.triggerType,
      status: 'running',
      startedAt: new Date(),
    })
    .returning();
  return row;
}

async function completeDeliveryRun(input: {
  runId: string;
  status: 'succeeded' | 'failed';
  artifactRunId?: string | null;
  payloadJson?: Record<string, unknown> | null;
  responseJson?: Record<string, unknown> | null;
  errorText?: string | null;
}) {
  const [row] = await db
    .update(schema.deliveryRuns)
    .set({
      status: input.status,
      artifactRunId: input.artifactRunId || null,
      payloadJson: input.payloadJson || null,
      responseJson: input.responseJson || null,
      errorText: input.errorText || null,
      completedAt: new Date(),
    })
    .where(eq(schema.deliveryRuns.id, input.runId))
    .returning();
  return row;
}

export async function runDeliveryChannelNow(input: {
  organizationId: string;
  channelId: string;
  triggerType?: DeliveryTrigger;
}) {
  await ensureProjectAgentTables();
  const channel = await getDeliveryChannelById({
    channelId: input.channelId,
    organizationId: input.organizationId,
  });
  if (!channel) throw new Error('Delivery channel not found');

  const artifactBundle = await getArtifactById(channel.artifactId, channel.organizationId);
  if (!artifactBundle) throw new Error('Artifact not found for channel');

  const run = await createDeliveryRun({
    channelId: channel.id,
    organizationId: channel.organizationId,
    projectId: channel.projectId,
    artifactId: channel.artifactId,
    triggerType: input.triggerType || 'manual',
  });

  try {
    const artifactRunResult = await runArtifact({
      organizationId: channel.organizationId,
      artifactId: channel.artifactId,
      triggerType: 'delivery',
    });

    if (artifactRunResult.run.status !== 'succeeded') {
      throw new Error(artifactRunResult.run.errorText || 'Artifact run failed before delivery');
    }

    const payload = buildDeliveryPayload({
      artifactName: artifactBundle.artifact.name,
      run: artifactRunResult.run,
      messageTemplate: ((channel.configJson as DeliveryConfig | null)?.messageTemplate || '').trim() || undefined,
    });

    const response = await dispatchDelivery({
      channelType: channel.channelType as DeliveryChannelType,
      config: (channel.configJson as DeliveryConfig | null) || {},
      payload,
    });

    await completeDeliveryRun({
      runId: run.id,
      status: 'succeeded',
      artifactRunId: artifactRunResult.run.id,
      payloadJson: payload,
      responseJson: response,
    });

    await db
      .update(schema.deliveryChannels)
      .set({
        lastRunAt: new Date(),
        lastStatus: 'succeeded',
        lastError: null,
        nextRunAt: calculateNextRunAt({
          deliveryMode: channel.deliveryMode as DeliveryMode,
          scheduleFrequency: channel.scheduleFrequency as DeliveryFrequency | null,
          scheduleDayOfWeek: channel.scheduleDayOfWeek,
          scheduleDayOfMonth: channel.scheduleDayOfMonth,
          scheduleTime: channel.scheduleTime,
          fromDate: new Date(),
        }),
        updatedAt: new Date(),
      })
      .where(eq(schema.deliveryChannels.id, channel.id));

    return {
      channel,
      run: artifactRunResult.run,
      deliveryRunId: run.id,
      response,
    };
  } catch (error: any) {
    await completeDeliveryRun({
      runId: run.id,
      status: 'failed',
      errorText: error?.message || 'Delivery run failed',
    });

    await db
      .update(schema.deliveryChannels)
      .set({
        lastRunAt: new Date(),
        lastStatus: 'failed',
        lastError: error?.message || 'Delivery run failed',
        nextRunAt: calculateNextRunAt({
          deliveryMode: channel.deliveryMode as DeliveryMode,
          scheduleFrequency: channel.scheduleFrequency as DeliveryFrequency | null,
          scheduleDayOfWeek: channel.scheduleDayOfWeek,
          scheduleDayOfMonth: channel.scheduleDayOfMonth,
          scheduleTime: channel.scheduleTime,
          fromDate: new Date(),
        }),
        updatedAt: new Date(),
      })
      .where(eq(schema.deliveryChannels.id, channel.id));

    throw error;
  }
}

export async function runDueScheduledDeliveryChannels(input: {
  organizationId?: string;
  now?: Date;
  limit?: number;
}) {
  await ensureProjectAgentTables();
  const now = input.now || new Date();
  const clauses = [
    eq(schema.deliveryChannels.isEnabled, 1),
    eq(schema.deliveryChannels.deliveryMode, 'scheduled'),
    lte(schema.deliveryChannels.nextRunAt, now),
  ];
  if (input.organizationId) {
    clauses.push(eq(schema.deliveryChannels.organizationId, input.organizationId));
  }

  const due = await db
    .select()
    .from(schema.deliveryChannels)
    .where(and(...clauses))
    .orderBy(asc(schema.deliveryChannels.nextRunAt))
    .limit(Math.max(1, Math.min(Number(input.limit || 25), 100)));

  const results = [] as Array<{ channelId: string; status: 'succeeded' | 'failed'; message?: string }>;
  for (const channel of due) {
    try {
      await runDeliveryChannelNow({
        organizationId: channel.organizationId,
        channelId: channel.id,
        triggerType: 'scheduled',
      });
      results.push({ channelId: channel.id, status: 'succeeded' });
    } catch (error: any) {
      results.push({
        channelId: channel.id,
        status: 'failed',
        message: error?.message || 'Delivery failed',
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
}

function sanitizeDeliveryConfig(raw: DeliveryConfig | null): DeliveryConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const next: DeliveryConfig = {};

  if (raw.email) {
    next.email = {
      recipients: Array.isArray(raw.email.recipients)
        ? raw.email.recipients
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        : [],
      subject: String(raw.email.subject || '').trim() || undefined,
      includeCsvAttachment: Boolean(raw.email.includeCsvAttachment),
    };
  }

  if (raw.slack) {
    next.slack = {
      webhookUrl: String(raw.slack.webhookUrl || '').trim() || undefined,
      botToken: String(raw.slack.botToken || '').trim() || undefined,
      channel: String(raw.slack.channel || '').trim() || undefined,
    };
  }

  if (raw.teams) {
    next.teams = {
      webhookUrl: String(raw.teams.webhookUrl || '').trim() || undefined,
    };
  }

  const template = String(raw.messageTemplate || '').trim();
  if (template) next.messageTemplate = template;

  return next;
}

function calculateNextRunAt(input: {
  deliveryMode: DeliveryMode;
  scheduleFrequency: DeliveryFrequency | null;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
  scheduleTime: string | null;
  fromDate: Date;
}): Date | null {
  if (input.deliveryMode !== 'scheduled') return null;

  const [hour, minute] = parseScheduleTime(input.scheduleTime || '09:00');
  const base = new Date(input.fromDate);

  if (input.scheduleFrequency === 'weekly') {
    const targetDow = clampInt(input.scheduleDayOfWeek ?? 1, 0, 6);
    const candidate = new Date(base);
    candidate.setUTCHours(hour, minute, 0, 0);
    const currentDow = candidate.getUTCDay();
    let delta = targetDow - currentDow;
    if (delta < 0 || (delta === 0 && candidate <= base)) delta += 7;
    candidate.setUTCDate(candidate.getUTCDate() + delta);
    return candidate;
  }

  if (input.scheduleFrequency === 'monthly') {
    const targetDay = clampInt(input.scheduleDayOfMonth ?? 1, 1, 31);
    const candidate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, hour, minute, 0, 0));
    candidate.setUTCDate(Math.min(targetDay, daysInUtcMonth(candidate.getUTCFullYear(), candidate.getUTCMonth())));
    if (candidate <= base) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1, 1);
      candidate.setUTCDate(Math.min(targetDay, daysInUtcMonth(candidate.getUTCFullYear(), candidate.getUTCMonth())));
    }
    return candidate;
  }

  const candidate = new Date(base);
  candidate.setUTCHours(hour, minute, 0, 0);
  if (candidate <= base) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

function parseScheduleTime(value: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return [9, 0];
  const hour = clampInt(Number(match[1]), 0, 23);
  const minute = clampInt(Number(match[2]), 0, 59);
  return [hour, minute];
}

function clampInt(value: number, min: number, max: number): number {
  const numeric = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.max(min, Math.min(max, numeric));
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function buildDeliveryPayload(input: {
  artifactName: string;
  run: {
    id: string;
    startedAt: Date | string;
    resultMetaJson?: unknown;
    resultSampleJson?: unknown;
    sqlTextSnapshot?: string | null;
  };
  messageTemplate?: string;
}) {
  const rows = Array.isArray(input.run.resultSampleJson)
    ? (input.run.resultSampleJson as Array<Record<string, unknown>>)
    : [];

  const defaultSummary = `Artifact ${input.artifactName} ran successfully with ${rows.length} preview rows.`;
  return {
    artifactName: input.artifactName,
    artifactRunId: input.run.id,
    startedAt: new Date(input.run.startedAt).toISOString(),
    summary: input.messageTemplate || defaultSummary,
    rowCount: Number((input.run.resultMetaJson as any)?.rowCount || rows.length || 0),
    columns: inferColumns(rows),
    sql: input.run.sqlTextSnapshot || null,
    rows,
  };
}

function inferColumns(rows: Array<Record<string, unknown>>): string[] {
  if (!rows.length) return [];
  return Object.keys(rows[0] || {});
}

async function dispatchDelivery(input: {
  channelType: DeliveryChannelType;
  config: DeliveryConfig;
  payload: {
    artifactName: string;
    artifactRunId: string;
    summary: string;
    rowCount: number;
    columns: string[];
    sql: string | null;
    rows: Array<Record<string, unknown>>;
    startedAt: string;
  };
}) {
  if (input.channelType === 'email') {
    return sendEmailDelivery(input.config, input.payload);
  }
  if (input.channelType === 'slack') {
    return sendSlackDelivery(input.config, input.payload);
  }
  return sendTeamsDelivery(input.config, input.payload);
}

async function sendEmailDelivery(
  config: DeliveryConfig,
  payload: {
    artifactName: string;
    artifactRunId: string;
    summary: string;
    rowCount: number;
    columns: string[];
    sql: string | null;
    rows: Array<Record<string, unknown>>;
    startedAt: string;
  },
) {
  const recipients = config.email?.recipients || [];
  if (!recipients.length) throw new Error('Email recipients are required for email delivery');

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured');

  const subject = config.email?.subject || `Delivery: ${payload.artifactName}`;
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const html = `
    <h2>${escapeHtml(payload.artifactName)}</h2>
    <p>${escapeHtml(payload.summary)}</p>
    <p><strong>Run:</strong> ${escapeHtml(payload.artifactRunId)}</p>
    <p><strong>Executed:</strong> ${escapeHtml(payload.startedAt)}</p>
    <p><strong>Rows:</strong> ${payload.rowCount}</p>
    <p><strong>Columns:</strong> ${escapeHtml(payload.columns.join(', ') || 'n/a')}</p>
    ${payload.sql ? `<pre>${escapeHtml(payload.sql)}</pre>` : ''}
  `;

  const body: Record<string, unknown> = {
    from,
    to: recipients,
    subject,
    html,
  };

  if (config.email?.includeCsvAttachment) {
    const csv = toCsv(payload.rows);
    body.attachments = [
      {
        filename: `${sanitizeFilename(payload.artifactName)}.csv`,
        content: Buffer.from(csv, 'utf-8').toString('base64'),
      },
    ];
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend error: ${JSON.stringify(data)}`);
  }
  return {
    provider: 'resend',
    id: String((data as any)?.id || ''),
  };
}

async function sendSlackDelivery(
  config: DeliveryConfig,
  payload: {
    artifactName: string;
    artifactRunId: string;
    summary: string;
    rowCount: number;
    columns: string[];
    sql: string | null;
    rows: Array<Record<string, unknown>>;
    startedAt: string;
  },
) {
  const webhookUrl = config.slack?.webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
  const botToken = config.slack?.botToken || process.env.SLACK_BOT_TOKEN || '';
  const channel = config.slack?.channel || process.env.SLACK_DEFAULT_CHANNEL || '';

  const text = [
    `*${payload.artifactName}*`,
    payload.summary,
    `Rows: ${payload.rowCount}`,
    payload.columns.length ? `Columns: ${payload.columns.join(', ')}` : '',
    `Run: ${payload.artifactRunId}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Slack webhook error: ${body}`);
    }
    return { provider: 'slack-webhook', ok: true };
  }

  if (botToken && channel) {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !(data as any)?.ok) {
      throw new Error(`Slack bot error: ${JSON.stringify(data)}`);
    }
    return {
      provider: 'slack-bot',
      ts: String((data as any)?.ts || ''),
      channel: String((data as any)?.channel || channel),
    };
  }

  throw new Error('Slack delivery requires webhook URL or bot token + channel');
}

async function sendTeamsDelivery(
  config: DeliveryConfig,
  payload: {
    artifactName: string;
    artifactRunId: string;
    summary: string;
    rowCount: number;
    columns: string[];
    sql: string | null;
    rows: Array<Record<string, unknown>>;
    startedAt: string;
  },
) {
  const webhookUrl = config.teams?.webhookUrl || process.env.TEAMS_WEBHOOK_URL || '';
  if (!webhookUrl) throw new Error('Teams webhook URL is required');

  const body = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    summary: payload.summary,
    themeColor: '0078D7',
    title: payload.artifactName,
    sections: [
      {
        facts: [
          { name: 'Run', value: payload.artifactRunId },
          { name: 'Executed', value: payload.startedAt },
          { name: 'Rows', value: String(payload.rowCount) },
          {
            name: 'Columns',
            value: payload.columns.join(', ') || 'n/a',
          },
        ],
        text: payload.summary,
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Teams webhook error: ${responseText}`);
  }

  return {
    provider: 'teams-webhook',
    ok: true,
    response: responseText,
  };
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return 'no_data\n';
  const columns = inferColumns(rows);
  const header = columns.map(escapeCsvCell).join(',');
  const lines = rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(','));
  return [header, ...lines].join('\n');
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[,"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function sanitizeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\-_.]+/g, '-').replace(/^-+|-+$/g, '') || 'artifact';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
