/**
 * Organization Settings API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, canAccessOrgAdmin, canManageOrganization } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

type GoogleSheetsExecutionMode = 'bigquery_external' | 'duckdb_memory';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  
  if (!canAccessOrgAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const organizationId = request.nextUrl.searchParams.get('organizationId') || user?.organizationId;
  
  if (!organizationId || !canManageOrganization(user, organizationId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1);
    
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const settings = org.settings as Record<string, unknown> || {};
    const googleSheetsExecutionMode: GoogleSheetsExecutionMode =
      settings.googleSheetsExecutionMode === 'duckdb_memory' ? 'duckdb_memory' : 'bigquery_external';
    
    return NextResponse.json({
      name: org.name,
      slug: org.slug,
      allowMemberInvites: settings.allowMemberInvites ?? true,
      requireApproval: settings.requireApproval ?? false,
      defaultUserRole: settings.defaultUserRole ?? 'member',
      googleSheetsExecutionMode,
    });
  } catch (error) {
    console.error('[org/settings] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  
  if (!canAccessOrgAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { organizationId, name, allowMemberInvites, requireApproval, defaultUserRole, googleSheetsExecutionMode } = await request.json();
    
    const targetOrgId = organizationId || user?.organizationId;
    
    if (!targetOrgId || !canManageOrganization(user, targetOrgId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const [currentOrg] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, targetOrgId))
      .limit(1);

    if (!currentOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const currentSettings = (currentOrg.settings as Record<string, unknown>) || {};
    const nextGoogleSheetsExecutionMode: GoogleSheetsExecutionMode =
      googleSheetsExecutionMode === 'duckdb_memory' ? 'duckdb_memory' : 'bigquery_external';

    await db
      .update(schema.organizations)
      .set({
        name: name || undefined,
        settings: {
          ...currentSettings,
          allowMemberInvites,
          requireApproval,
          defaultUserRole,
          googleSheetsExecutionMode: nextGoogleSheetsExecutionMode,
        },
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, targetOrgId));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[org/settings] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
