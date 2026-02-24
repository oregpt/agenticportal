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
        router.push(`/artifacts/${createdId}`);
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
        <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-5">Dashboard</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>
        <div className="divide-y">
          {dashboards.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No dashboards yet. Create your first dashboard to start collecting artifacts.</div>
          ) : (
            dashboards.map((dashboard) => (
              <div key={dashboard.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
                <div className="col-span-5 min-w-0">
                  <Link href={`/artifacts/${dashboard.id}`} className="truncate font-medium hover:underline inline-flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    {dashboard.name}
                  </Link>
                  {dashboard.description ? <p className="text-xs text-muted-foreground truncate mt-0.5">{dashboard.description}</p> : null}
                </div>
                <div className="col-span-3">
                  <Badge variant={dashboard.status === 'active' ? 'default' : dashboard.status === 'error' ? 'destructive' : 'secondary'}>
                    {dashboard.status || 'active'}
                  </Badge>
                </div>
                <div className="col-span-4 flex justify-end gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/artifacts/${dashboard.id}`}>Open</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/artifacts/${dashboard.id}/compose`}>Compose</Link>
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
