import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

type OutputConfig = {
  email?: string;
  schedule?: string;
  contentMode?: 'full_dashboard' | 'top_widgets' | 'custom_summary';
  customPrompt?: string;
};

async function requireOrgContext() {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return null;
  }

  return {
    userId: user.id,
    orgId: user.organizationId,
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireOrgContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [output] = await db
      .select()
      .from(schema.outputs)
      .where(
        and(
          eq(schema.outputs.id, id),
          eq(schema.outputs.organizationId, context.orgId)
        )
      );

    if (!output) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 });
    }

    if (output.type !== 'email') {
      return NextResponse.json(
        { error: `Run is currently implemented for email outputs only. Received: ${output.type}` },
        { status: 400 }
      );
    }

    const config = (output.config || {}) as OutputConfig;
    const recipient = config.email?.trim();
    if (!recipient) {
      return NextResponse.json({ error: 'Output email recipient is missing' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured on the server' },
        { status: 500 }
      );
    }

    const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const [dashboard] = await db
      .select({
        id: schema.dashboards.id,
        name: schema.dashboards.name,
      })
      .from(schema.dashboards)
      .where(
        and(
          eq(schema.dashboards.id, output.dashboardId),
          eq(schema.dashboards.organizationId, context.orgId)
        )
      );

    const widgets = await db
      .select({
        id: schema.widgets.id,
        title: schema.widgets.title,
        type: schema.widgets.type,
      })
      .from(schema.widgets)
      .where(eq(schema.widgets.dashboardId, output.dashboardId));

    const now = new Date();
    const widgetLines = widgets.length
      ? widgets
          .map((w) => `<li>${w.title || 'Untitled'} (${w.type})</li>`)
          .join('')
      : '<li>No widgets configured yet</li>';

    const contentMode = config.contentMode || 'full_dashboard';
    const contentSection =
      contentMode === 'custom_summary'
        ? `<p><strong>Custom Prompt:</strong> ${config.customPrompt || 'Not provided'}</p>`
        : contentMode === 'top_widgets'
          ? `<p><strong>Content:</strong> Top widgets summary</p>`
          : `<p><strong>Content:</strong> Full dashboard snapshot</p>`;

    const schedule = output.schedule || config.schedule || 'on_demand';
    const scheduleLabel =
      schedule === 'manual' || schedule === 'on_demand'
        ? 'On-demand'
        : schedule.charAt(0).toUpperCase() + schedule.slice(1);

    const subject = `Output Run: ${output.name}`;
    const html = `
      <h2>${output.name}</h2>
      <p>This output was executed at ${now.toISOString()}.</p>
      <p><strong>Dashboard:</strong> ${dashboard?.name || output.dashboardId}</p>
      <p><strong>Schedule:</strong> ${scheduleLabel}</p>
      ${contentSection}
      <p><strong>Widgets:</strong></p>
      <ul>${widgetLines}</ul>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html,
      }),
    });

    const resendJson = await resendResponse.json();
    if (!resendResponse.ok) {
      await db
        .update(schema.outputs)
        .set({
          status: 'error',
          updatedAt: now,
        })
        .where(eq(schema.outputs.id, output.id));

      return NextResponse.json(
        {
          error: 'Failed to send email via Resend',
          details: resendJson,
        },
        { status: 502 }
      );
    }

    await db
      .update(schema.outputs)
      .set({
        status: 'active',
        lastRunAt: now,
        updatedAt: now,
      })
      .where(eq(schema.outputs.id, output.id));

    return NextResponse.json({
      success: true,
      provider: 'resend',
      messageId: resendJson?.id,
      sentTo: recipient,
      from,
      ranAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Error running output:', error);
    return NextResponse.json(
      { error: 'Failed to run output' },
      { status: 500 }
    );
  }
}
