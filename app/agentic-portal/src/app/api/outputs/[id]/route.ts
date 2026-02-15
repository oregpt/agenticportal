import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

async function requireOrgContext() {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return null;
  }

  return {
    orgId: user.organizationId,
  };
}

export async function GET(
  request: NextRequest,
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

    return NextResponse.json({ output });
  } catch (error) {
    console.error('Error fetching output:', error);
    return NextResponse.json({ error: 'Failed to fetch output' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireOrgContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [output] = await db
      .select({ id: schema.outputs.id })
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

    await db
      .delete(schema.outputs)
      .where(
        and(
          eq(schema.outputs.id, id),
          eq(schema.outputs.organizationId, context.orgId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting output:', error);
    return NextResponse.json({ error: 'Failed to delete output' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireOrgContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, schedule, status, config } = body as {
      name?: string;
      schedule?: string;
      status?: string;
      config?: Record<string, unknown>;
    };

    const [existing] = await db
      .select({ id: schema.outputs.id, config: schema.outputs.config })
      .from(schema.outputs)
      .where(
        and(
          eq(schema.outputs.id, id),
          eq(schema.outputs.organizationId, context.orgId)
        )
      );

    if (!existing) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 });
    }

    const mergedConfig =
      config !== undefined
        ? {
            ...(existing.config || {}),
            ...config,
          }
        : undefined;

    const [updated] = await db
      .update(schema.outputs)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(schedule !== undefined ? { schedule } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(mergedConfig !== undefined ? { config: mergedConfig } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.outputs.id, id),
          eq(schema.outputs.organizationId, context.orgId)
        )
      )
      .returning();

    return NextResponse.json({ output: updated });
  } catch (error) {
    console.error('Error updating output:', error);
    return NextResponse.json({ error: 'Failed to update output' }, { status: 500 });
  }
}
