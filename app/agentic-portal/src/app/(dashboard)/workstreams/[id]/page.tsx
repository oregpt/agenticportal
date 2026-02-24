'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Database,
  LayoutDashboard,
  Loader2,
  PlusCircle,
  Table2,
  Trash2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
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

function artifactTypeLabel(node: PipelineNode): string {
  const metadataType = String(node.metadata?.displayType || node.metadata?.artifactType || '').toLowerCase();
  if (metadataType === 'kpi' || metadataType === 'metric') return 'Metric';
  if (metadataType === 'report') return 'Table';
  if (metadataType === 'chart') return 'Chart';
  if (metadataType === 'table') return 'Table';
  return 'Artifact';
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workstreamId = String(params?.id || '');

  const [workstream, setWorkstream] = useState<Workstream | null>(null);
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');

  async function loadProject() {
    if (!workstreamId) return;
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`/api/workstreams/${workstreamId}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to load project');
      setWorkstream(payload.workstream || null);
      setNodes(payload.nodes || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load project');
      setWorkstream(null);
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProject();
  }, [workstreamId]);

  const sources = useMemo(() => nodes.filter((n) => n.type === 'datasource'), [nodes]);
  const dashboards = useMemo(() => nodes.filter((n) => n.type === 'dashboard'), [nodes]);
  const artifacts = useMemo(() => nodes.filter((n) => n.type === 'view'), [nodes]);
  const projectAgent = useMemo(
    () => nodes.find((n) => n.type === 'output' && String(n.metadata?.type || '') === 'project_agent') || null,
    [nodes]
  );

  const dashboardById = useMemo(() => {
    const map = new Map<string, PipelineNode>();
    for (const dashboard of dashboards) map.set(dashboard.id, dashboard);
    return map;
  }, [dashboards]);

  const dashboardsByArtifactId = useMemo(() => {
    const map = new Map<string, PipelineNode[]>();
    for (const dashboard of dashboards) {
      for (const artifactId of dashboard.parentIds || []) {
        const list = map.get(artifactId) || [];
        list.push(dashboard);
        map.set(artifactId, list);
      }
    }
    return map;
  }, [dashboards]);

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
          description: 'Dashboard created from project canvas.',
          configJson: { mode: 'grid' },
          layoutJson: { columns: 12 },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to create dashboard');
      const createdId = String(payload?.artifact?.id || '');
      if (!createdId) throw new Error('Dashboard created but no id returned');
      router.push(`/dashboard/${createdId}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to create dashboard');
    } finally {
      setIsCreatingDashboard(false);
    }
  }

  async function deleteSource(sourceId: string) {
    const confirmed = window.confirm('Delete this data source?');
    if (!confirmed) return;
    try {
      setDeletingId(sourceId);
      setError('');
      const res = await fetch(`/api/datasources/${sourceId}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to delete data source');
      await loadProject();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete data source');
    } finally {
      setDeletingId('');
    }
  }

  async function deleteArtifact(artifactId: string, label: string) {
    const confirmed = window.confirm(`Delete ${label}?`);
    if (!confirmed) return;
    try {
      setDeletingId(artifactId);
      setError('');
      const res = await fetch(`/api/artifacts/${artifactId}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `Failed to delete ${label}`);
      await loadProject();
    } catch (e: any) {
      setError(e?.message || `Failed to delete ${label}`);
    } finally {
      setDeletingId('');
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading project canvas...
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
            Sources feed dashboards, dashboards contain artifacts, and Project Agent helps generate them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => void createDashboard()} disabled={isCreatingDashboard}>
            {isCreatingDashboard ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            Create Dashboard
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/project-agent?projectId=${encodeURIComponent(workstreamId)}`}>
              <Bot className="h-4 w-4 mr-2" /> Configure Agent
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 flex flex-wrap items-center gap-3 text-sm">
          <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5">
            <Database className="h-4 w-4 text-blue-500" /> Sources <Badge variant="secondary">{sources.length}</Badge>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5">
            <LayoutDashboard className="h-4 w-4 text-violet-500" /> Dashboards <Badge variant="secondary">{dashboards.length}</Badge>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5">
            <Table2 className="h-4 w-4 text-amber-500" /> Artifacts <Badge variant="secondary">{artifacts.length}</Badge>
          </div>
          <div className="ml-auto inline-flex items-center gap-2 rounded-md border px-3 py-1.5 bg-muted/30">
            <Sparkles className="h-4 w-4 text-emerald-600" /> Project Agent
            <Badge variant={projectAgent ? 'default' : 'outline'}>{projectAgent ? 'Configured' : 'Not Created'}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sources</h2>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/datasources?workstreamId=${encodeURIComponent(workstreamId)}`}>Add</Link>
              </Button>
            </div>
            {sources.length === 0 ? <p className="text-xs text-muted-foreground">No sources assigned.</p> : null}
            <div className="space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="rounded-md border p-2">
                  <p className="text-sm font-medium truncate">{source.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{source.description || 'Data source'}</p>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/datasources/${source.id}`}>Open</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => void deleteSource(source.id)}
                      disabled={deletingId === source.id}
                    >
                      {deletingId === source.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Dashboards</h2>
              <Button size="sm" variant="outline" onClick={() => void createDashboard()} disabled={isCreatingDashboard}>
                {isCreatingDashboard ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                Add
              </Button>
            </div>
            {dashboards.length === 0 ? <p className="text-xs text-muted-foreground">No dashboards yet.</p> : null}
            <div className="space-y-2">
              {dashboards.map((dashboard) => (
                <div key={dashboard.id} className="rounded-md border p-2">
                  <p className="text-sm font-medium truncate">{dashboard.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(dashboard.parentIds || []).length} artifact{(dashboard.parentIds || []).length === 1 ? '' : 's'}
                  </p>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/${dashboard.id}`}>Open</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => void deleteArtifact(dashboard.id, 'dashboard')}
                      disabled={deletingId === dashboard.id}
                    >
                      {deletingId === dashboard.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Artifacts</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!dashboards.length) {
                    setError('Create a dashboard first, then add artifacts.');
                    return;
                  }
                  router.push(`/dashboard/${dashboards[0].id}`);
                }}
              >
                Add
              </Button>
            </div>
            {artifacts.length === 0 ? <p className="text-xs text-muted-foreground">No artifacts yet.</p> : null}
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {artifacts.map((artifact) => {
                const linkedDashboards = dashboardsByArtifactId.get(artifact.id) || [];
                return (
                  <div key={artifact.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{artifact.name}</p>
                      <Badge variant="outline">{artifactTypeLabel(artifact)}</Badge>
                    </div>
                    {linkedDashboards.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {linkedDashboards.slice(0, 2).map((dashboard) => (
                          <span key={dashboard.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {dashboardById.get(dashboard.id)?.name || dashboard.id}
                          </span>
                        ))}
                        {linkedDashboards.length > 2 ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{linkedDashboards.length - 2}</span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">Not added to a dashboard yet</p>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/artifacts/${artifact.id}`}>Open</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => void deleteArtifact(artifact.id, 'artifact')}
                        disabled={deletingId === artifact.id}
                      >
                        {deletingId === artifact.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Project Agent</p>
            <p className="text-xs text-muted-foreground">
              {projectAgent ? `${projectAgent.name} is ready to generate SQL-backed artifacts.` : 'No agent created yet for this project.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/project-agent?projectId=${encodeURIComponent(workstreamId)}`}>Configure</Link>
            </Button>
            <Button asChild>
              <Link href={`/project-agent/chat?projectId=${encodeURIComponent(workstreamId)}`}>Open</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
