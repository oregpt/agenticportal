'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bot, Database, LayoutDashboard, Loader2, PlusCircle, Table2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type NodeType = 'datasource' | 'view' | 'dashboard' | 'output';

type PipelineNode = {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  parentIds: string[];
  status?: 'active' | 'syncing' | 'error';
  metadata?: Record<string, unknown>;
};

type Workstream = {
  id: string;
  name: string;
  description?: string | null;
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workstreamId = String(params?.id || '');

  const [workstream, setWorkstream] = useState<Workstream | null>(null);
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!workstreamId) return;
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError('');
        const res = await fetch(`/api/workstreams/${workstreamId}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to load project');
        if (!cancelled) {
          setWorkstream(payload.workstream || null);
          setNodes(payload.nodes || []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load project');
          setWorkstream(null);
          setNodes([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workstreamId]);

  const dashboards = useMemo(() => nodes.filter((n) => n.type === 'dashboard'), [nodes]);
  const artifacts = useMemo(() => nodes.filter((n) => n.type === 'view'), [nodes]);
  const sources = useMemo(() => nodes.filter((n) => n.type === 'datasource'), [nodes]);
  const artifactCountByDashboard = useMemo(() => {
    const counts = new Map<string, number>();
    for (const artifact of artifacts) {
      for (const parentId of artifact.parentIds || []) {
        counts.set(parentId, (counts.get(parentId) || 0) + 1);
      }
    }
    return counts;
  }, [artifacts]);
  const artifactListByDashboard = useMemo(() => {
    const mapping = new Map<string, PipelineNode[]>();
    for (const artifact of artifacts) {
      for (const parentId of artifact.parentIds || []) {
        const list = mapping.get(parentId) || [];
        list.push(artifact);
        mapping.set(parentId, list);
      }
    }
    return mapping;
  }, [artifacts]);
  const checklist = useMemo(
    () => [
      {
        id: 'sources',
        title: 'Assign at least one data source',
        done: sources.length > 0,
        actionHref: `/datasources?workstreamId=${encodeURIComponent(workstreamId)}`,
        actionLabel: 'Assign Sources',
      },
      {
        id: 'dashboards',
        title: 'Create your first dashboard',
        done: dashboards.length > 0,
        actionHref: '',
        actionLabel: 'Create Dashboard',
      },
      {
        id: 'artifacts',
        title: 'Add at least one artifact block',
        done: artifacts.length > 0,
        actionHref: dashboards[0]?.id ? `/dashboard/${dashboards[0].id}` : '',
        actionLabel: 'Open Dashboard',
      },
    ],
    [artifacts.length, dashboards, sources.length, workstreamId]
  );

  async function createDashboard() {
    if (!workstreamId) return;
    try {
      setIsCreatingDashboard(true);
      setError('');
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: workstreamId,
          type: 'dashboard',
          name: `Dashboard ${new Date().toLocaleString()}`,
          description: 'Dashboard created from project page.',
          configJson: { mode: 'grid' },
          layoutJson: { columns: 12 },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to create dashboard');
      const createdId = payload?.artifact?.id as string | undefined;
      if (createdId) {
        router.push(`/dashboard/${createdId}`);
        return;
      }
      throw new Error('Dashboard created but no id returned');
    } catch (e: any) {
      setError(e?.message || 'Failed to create dashboard');
    } finally {
      setIsCreatingDashboard(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading project...
      </div>
    );
  }

  if (!workstream) {
    return <div className="p-8 text-sm text-red-600">{error || 'Project not found'}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/workstreams" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Projects
          </Link>
          <h1 className="text-2xl font-semibold">{workstream.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {workstream.description || 'Create dashboards, then add artifacts manually or with the project agent.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => void createDashboard()} disabled={isCreatingDashboard}>
            {isCreatingDashboard ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            Create Dashboard
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/project-agent/chat?projectId=${encodeURIComponent(workstreamId)}`}>
              <Bot className="h-4 w-4 mr-2" />
              Open Project Agent
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Dashboards</p>
              <p className="text-2xl font-semibold">{dashboards.length}</p>
            </div>
            <LayoutDashboard className="h-5 w-5 text-violet-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Artifacts</p>
              <p className="text-2xl font-semibold">{artifacts.length}</p>
            </div>
            <Table2 className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Data Sources</p>
              <p className="text-2xl font-semibold">{sources.length}</p>
            </div>
            <Database className="h-5 w-5 text-blue-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Project Setup Checklist</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Complete these to get from project setup to a working dashboard.
          </p>
        </div>
        <div className="divide-y">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.done ? 'Complete' : 'Pending'}</p>
              </div>
              {item.done ? (
                <Badge variant="default">Done</Badge>
              ) : item.id === 'dashboards' ? (
                <Button size="sm" onClick={() => void createDashboard()} disabled={isCreatingDashboard}>
                  {isCreatingDashboard ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                  {item.actionLabel}
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link href={item.actionHref}>{item.actionLabel}</Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-5">Dashboard</div>
          <div className="col-span-2">Artifacts</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        <div className="divide-y">
          {dashboards.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No dashboards yet. Create your first dashboard to start collecting artifacts.</div>
          ) : (
            dashboards.map((dashboard) => (
              <div key={dashboard.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
                <div className="col-span-5 min-w-0">
                  <Link href={`/dashboard/${dashboard.id}`} className="truncate font-medium hover:underline inline-flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    {dashboard.name}
                  </Link>
                  {dashboard.description ? <p className="text-xs text-muted-foreground truncate mt-0.5">{dashboard.description}</p> : null}
                  {(artifactListByDashboard.get(dashboard.id)?.length || 0) > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(artifactListByDashboard.get(dashboard.id) || []).slice(0, 3).map((artifact) => (
                        <span key={artifact.id} className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] text-muted-foreground">
                          {artifact.name}
                        </span>
                      ))}
                      {(artifactListByDashboard.get(dashboard.id)?.length || 0) > 3 ? (
                        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] text-muted-foreground">
                          +{(artifactListByDashboard.get(dashboard.id)?.length || 0) - 3} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {artifactCountByDashboard.get(dashboard.id) || 0}
                </div>
                <div className="col-span-2">
                  <Badge variant={dashboard.status === 'active' ? 'default' : dashboard.status === 'error' ? 'destructive' : 'secondary'}>
                    {dashboard.status || 'active'}
                  </Badge>
                </div>
                <div className="col-span-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/${dashboard.id}`}>Open Dashboard</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={`/artifacts?workstreamId=${encodeURIComponent(workstreamId)}`}>View All Artifacts</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/datasources?workstreamId=${encodeURIComponent(workstreamId)}`}>Manage Data Sources</Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
