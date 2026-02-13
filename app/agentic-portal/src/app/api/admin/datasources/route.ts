/**
 * Platform Admin Data Sources API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, canAccessPlatformAdmin } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const user = await getCurrentUser();
  
  if (!canAccessPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    // Get all data sources with organization names
    const dataSources = await db
      .select({
        id: schema.dataSources.id,
        name: schema.dataSources.name,
        type: schema.dataSources.type,
        organizationId: schema.dataSources.organizationId,
        lastSyncedAt: schema.dataSources.lastSyncedAt,
        createdAt: schema.dataSources.createdAt,
      })
      .from(schema.dataSources)
      .orderBy(schema.dataSources.createdAt);
    
    // Get organization names
    const orgs = await db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
      })
      .from(schema.organizations);
    
    const orgMap = new Map(orgs.map(o => [o.id, o.name]));
    
    const dataSourcesWithOrgs = dataSources.map(ds => ({
      ...ds,
      organizationName: orgMap.get(ds.organizationId),
      status: ds.lastSyncedAt ? 'connected' : 'pending',
    }));
    
    return NextResponse.json({ dataSources: dataSourcesWithOrgs });
  } catch (error) {
    console.error('[admin/datasources] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data sources' },
      { status: 500 }
    );
  }
}
