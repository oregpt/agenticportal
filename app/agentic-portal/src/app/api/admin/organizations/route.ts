/**
 * Platform Admin Organizations API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, canAccessPlatformAdmin } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { sql, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const user = await getCurrentUser();
  
  if (!canAccessPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    // Get all organizations with user and datasource counts
    const organizations = await db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        slug: schema.organizations.slug,
        settings: schema.organizations.settings,
        createdAt: schema.organizations.createdAt,
      })
      .from(schema.organizations)
      .orderBy(schema.organizations.name);
    
    // Get user counts per org
    const userCounts = await db
      .select({
        organizationId: schema.users.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.users)
      .groupBy(schema.users.organizationId);
    
    // Get datasource counts per org
    const dsCounts = await db
      .select({
        organizationId: schema.dataSources.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.dataSources)
      .groupBy(schema.dataSources.organizationId);
    
    // Merge counts
    const userCountMap = new Map(userCounts.map(u => [u.organizationId, u.count]));
    const dsCountMap = new Map(dsCounts.map(d => [d.organizationId, d.count]));
    
    const orgsWithCounts = organizations.map(org => ({
      ...org,
      userCount: userCountMap.get(org.id) || 0,
      dataSourceCount: dsCountMap.get(org.id) || 0,
    }));
    
    return NextResponse.json({ organizations: orgsWithCounts });
  } catch (error) {
    console.error('[admin/organizations] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  
  if (!canAccessPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { name } = await request.json();
    
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }
    
    const id = uuidv4();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64);
    
    await db.insert(schema.organizations).values({
      id,
      name: name.trim(),
      slug,
      settings: {},
    });
    
    return NextResponse.json({ 
      organization: { id, name: name.trim(), slug } 
    });
  } catch (error) {
    console.error('[admin/organizations] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
