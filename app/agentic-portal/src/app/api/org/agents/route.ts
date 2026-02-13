/**
 * Organization Agents API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, canAccessOrgAdmin } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // For now, return all agents (in multi-tenant, would filter by org)
    const agents = await db
      .select({
        id: schema.agents.id,
        name: schema.agents.name,
        slug: schema.agents.slug,
        description: schema.agents.description,
        defaultModel: schema.agents.defaultModel,
        createdAt: schema.agents.createdAt,
      })
      .from(schema.agents)
      .orderBy(schema.agents.name);
    
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('[org/agents] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  
  if (!canAccessOrgAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { name, description, instructions } = await request.json();
    
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }
    
    const id = uuidv4();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64);
    
    await db.insert(schema.agents).values({
      id,
      name: name.trim(),
      slug,
      description: description || null,
      instructions: instructions || null,
      defaultModel: 'claude-sonnet-4-20250514',
    });
    
    return NextResponse.json({ 
      agent: { id, name: name.trim(), slug } 
    });
  } catch (error) {
    console.error('[org/agents] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
