import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import {
  clearAssignmentsForDataSource,
  getAssignedWorkstreamIdsForSources,
  replaceDataSourceAssignments,
} from '@/server/datasource-assignments';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [dataSource] = await db
      .select()
      .from(schema.dataSources)
      .where(
        and(
          eq(schema.dataSources.id, id),
          eq(schema.dataSources.organizationId, user.organizationId)
        )
      );

    if (!dataSource) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    const assignmentMap = await getAssignedWorkstreamIdsForSources(user.organizationId, [id]);

    const relatedViews = await db
      .select({ id: schema.views.id })
      .from(schema.views)
      .where(eq(schema.views.dataSourceId, id));

    return NextResponse.json({
      dataSource: {
        ...dataSource,
        assignedWorkstreamIds: assignmentMap.get(id) || [],
      },
      dependentViewCount: relatedViews.length,
    });
  } catch (error) {
    console.error('Error fetching data source:', error);
    return NextResponse.json({ error: 'Failed to fetch data source' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const workstreamIds: string[] = Array.isArray(body?.workstreamIds)
      ? body.workstreamIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    const [dataSource] = await db
      .select({ id: schema.dataSources.id })
      .from(schema.dataSources)
      .where(
        and(
          eq(schema.dataSources.id, id),
          eq(schema.dataSources.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!dataSource) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    const uniqueWorkstreamIds: string[] = Array.from(new Set(workstreamIds));
    if (uniqueWorkstreamIds.length > 0) {
      const valid = await db
        .select({ id: schema.workstreams.id })
        .from(schema.workstreams)
        .where(
          and(
            eq(schema.workstreams.organizationId, user.organizationId),
            inArray(schema.workstreams.id, uniqueWorkstreamIds)
          )
        );
      if (valid.length !== uniqueWorkstreamIds.length) {
        return NextResponse.json({ error: 'One or more projects are invalid' }, { status: 400 });
      }
    }

    const assignedWorkstreamIds = await replaceDataSourceAssignments({
      organizationId: user.organizationId,
      dataSourceId: id,
      workstreamIds: uniqueWorkstreamIds,
    });

    return NextResponse.json({ success: true, assignedWorkstreamIds });
  } catch (error) {
    console.error('Error updating data source assignments:', error);
    return NextResponse.json({ error: 'Failed to update assignments' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [dataSource] = await db
      .select({ id: schema.dataSources.id })
      .from(schema.dataSources)
      .where(
        and(
          eq(schema.dataSources.id, id),
          eq(schema.dataSources.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!dataSource) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    const relatedViews = await db
      .select({ id: schema.views.id })
      .from(schema.views)
      .where(eq(schema.views.dataSourceId, id));

    const relatedViewIds = relatedViews.map((view) => view.id);

    if (relatedViewIds.length > 0) {
      await db
        .delete(schema.widgets)
        .where(inArray(schema.widgets.viewId, relatedViewIds));

      await db
        .delete(schema.views)
        .where(inArray(schema.views.id, relatedViewIds));
    }

    await clearAssignmentsForDataSource(user.organizationId, id);

    await db
      .delete(schema.dataSources)
      .where(
        and(
          eq(schema.dataSources.id, id),
          eq(schema.dataSources.organizationId, user.organizationId)
        )
      );

    return NextResponse.json({ success: true, deletedViews: relatedViewIds.length });
  } catch (error) {
    console.error('Error deleting data source:', error);
    return NextResponse.json({ error: 'Failed to delete data source' }, { status: 500 });
  }
}
