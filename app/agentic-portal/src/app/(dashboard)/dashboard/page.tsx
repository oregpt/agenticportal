'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, LayoutDashboard, Loader2, PlusCircle, Search, Trash2 } from 'lucide-react';

type WorkstreamOption = { id: string; name: string };

type DashboardArtifact = {
  id: string;
  projectId: string;
  name: string;
  type: 'dashboard';
  description?: string | null;
  status: 'active' | 'archived';
  latestVersion: number;
  updatedAt: string;
};

type ArtifactItem = {
  id: string;
  name: string;
  type: 'table' | 'chart' | 'kpi' | 'report' | 'dashboard';
};

type DashboardItemRow = {
  id: string;
  childArtifactId: string;
};

export default function DashboardEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dashboards, setDashboards] = useState<DashboardArtifact[]>([]);
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [expandedDashboardId, setExpandedDashboardId] = useState('');
  const [dashboardItems, setDashboardItems] = useState<Record<string, DashboardItemRow[]>>({});
  const [loadingItemsForDashboardId, setLoadingItemsForDashboardId] = useState('');
  const [itemsArtifactLookup, setItemsArtifactLookup] = useState<Record<string, ArtifactItem>>({});
  const [removingItemId, setRemovingItemId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fromQuery = searchParams.get('workstreamId') || '';
    if (fromQuery) setSelectedWorkstreamId(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const wsRes = await fetch('/api/workstreams');
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          setWorkstreams((wsData.workstreams || []).map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError('');
        const params = new URLSearchParams({ type: 'dashboard' });
        if (selectedWorkstreamId) params.set('projectId', selectedWorkstreamId);
        const res = await fetch(`/api/artifacts?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load dashboards');
        setDashboards(data.artifacts || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load dashboards');
        setDashboards([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedWorkstreamId]);

  useEffect(() => {
    (async () => {
      try {
        const projectId = selectedWorkstreamId || '';
        if (!projectId) {
          setItemsArtifactLookup({});
          return;
        }
        const res = await fetch(`/api/artifacts?projectId=${encodeURIComponent(projectId)}&includeArchived=false`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const nextLookup: Record<string, ArtifactItem> = {};
        for (const artifact of payload.artifacts || []) {
          const type = String(artifact.type || '');
          if (!['table', 'chart', 'kpi', 'report', 'dashboard'].includes(type)) continue;
          nextLookup[String(artifact.id)] = {
            id: String(artifact.id),
            name: String(artifact.name || artifact.id),
            type: type as ArtifactItem['type'],
          };
        }
        setItemsArtifactLookup(nextLookup);
      } catch {}
    })();
  }, [selectedWorkstreamId]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return dashboards;
    return dashboards.filter((dashboard) => {
      return (
        dashboard.name.toLowerCase().includes(q) ||
        (dashboard.description || '').toLowerCase().includes(q) ||
        dashboard.status.toLowerCase().includes(q)
      );
    });
  }, [dashboards, searchText]);

  const handleWorkstreamChange = (value: string | undefined) => {
    setSelectedWorkstreamId(value || '');
  };

  async function deleteDashboard(dashboard: DashboardArtifact) {
    const ok = window.confirm(`Delete dashboard "${dashboard.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      setDeletingId(dashboard.id);
      const res = await fetch(`/api/artifacts/${dashboard.id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to delete dashboard');
      setDashboards((prev) => prev.filter((d) => d.id !== dashboard.id));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete dashboard');
    } finally {
      setDeletingId('');
    }
  }

  async function createDashboard() {
    const projectId = selectedWorkstreamId || (workstreams.length === 1 ? workstreams[0]?.id || '' : '');
    if (!projectId) {
      setError('Select a project first, then click Create Dashboard.');
      return;
    }

    try {
      setIsCreating(true);
      setError('');
      const name = `Dashboard ${new Date().toLocaleString()}`;
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          type: 'dashboard',
          name,
          description: 'Dashboard created from Dashboard page.',
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
      setIsCreating(false);
    }
  }

  async function toggleDrillIn(dashboardId: string) {
    if (expandedDashboardId === dashboardId) {
      setExpandedDashboardId('');
      return;
    }
    setExpandedDashboardId(dashboardId);
    if (dashboardItems[dashboardId]) return;
    try {
      setLoadingItemsForDashboardId(dashboardId);
      const res = await fetch(`/api/artifacts/${dashboardId}/items`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to load dashboard artifacts');
      const rows: DashboardItemRow[] = (payload.items || []).map((item: any) => ({
        id: String(item.id),
        childArtifactId: String(item.childArtifactId),
      }));
      setDashboardItems((prev) => ({ ...prev, [dashboardId]: rows }));
      const missingArtifactIds = Array.from(
        new Set(rows.map((row) => row.childArtifactId).filter((id) => id && !itemsArtifactLookup[id]))
      );
      if (missingArtifactIds.length > 0) {
        const detailResults = await Promise.all(
          missingArtifactIds.map(async (artifactId) => {
            const detailRes = await fetch(`/api/artifacts/${artifactId}`);
            const detailPayload = await detailRes.json().catch(() => ({}));
            if (!detailRes.ok || !detailPayload?.artifact) return null;
            const artifact = detailPayload.artifact;
            return {
              id: String(artifact.id),
              name: String(artifact.name || artifact.id),
              type: String(artifact.type || 'artifact') as ArtifactItem['type'],
            };
          })
        );
        const mapped = detailResults.filter((item): item is ArtifactItem => Boolean(item));
        if (mapped.length > 0) {
          setItemsArtifactLookup((prev) => {
            const next = { ...prev };
            for (const item of mapped) next[item.id] = item;
            return next;
          });
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard artifacts');
    } finally {
      setLoadingItemsForDashboardId('');
    }
  }

  async function removeArtifactFromDashboard(dashboardId: string, itemId: string) {
    try {
      setRemovingItemId(itemId);
      const res = await fetch(`/api/artifacts/${dashboardId}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to remove artifact from dashboard');
      setDashboardItems((prev) => ({
        ...prev,
        [dashboardId]: (prev[dashboardId] || []).filter((item) => item.id !== itemId),
      }));
    } catch (e: any) {
      setError(e?.message || 'Failed to remove artifact from dashboard');
    } finally {
      setRemovingItemId('');
    }
  }

  return (
    <div className="p-8 space-y-6">
      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={handleWorkstreamChange}
        pageLabel="Dashboards"
        pageDescription="Create and manage dashboards inside each project."
        rightSlot={
          <Button onClick={() => void createDashboard()} disabled={isCreating}>
            {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            Create Dashboard
          </Button>
        }
      />

      <div className="relative w-full md:w-80 ml-auto">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search dashboards..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboards...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">No dashboards yet. Click Create Dashboard to start this project workspace.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Version</div>
            <div className="col-span-2">Updated</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y">
            {filtered.map((dashboard) => (
              <div key={dashboard.id}>
              <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
                <div className="col-span-5 min-w-0">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                      onClick={() => void toggleDrillIn(dashboard.id)}
                      title={expandedDashboardId === dashboard.id ? 'Collapse artifacts' : 'Expand artifacts'}
                    >
                      {expandedDashboardId === dashboard.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <Link href={`/artifacts/${dashboard.id}`} className="truncate font-medium hover:underline inline-flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      {dashboard.name}
                    </Link>
                  </div>
                  {dashboard.description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{dashboard.description}</p> : null}
                </div>
                <div className="col-span-2 text-muted-foreground">v{dashboard.latestVersion}</div>
                <div className="col-span-2 text-xs text-muted-foreground">{new Date(dashboard.updatedAt).toLocaleString()}</div>
                <div className="col-span-1">
                  <Badge variant={dashboard.status === 'active' ? 'default' : 'secondary'}>{dashboard.status}</Badge>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/artifacts/${dashboard.id}`}>Open</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/artifacts/${dashboard.id}`}>Add Artifact</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void deleteDashboard(dashboard)}
                    disabled={deletingId === dashboard.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    {deletingId === dashboard.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {expandedDashboardId === dashboard.id ? (
                <div className="bg-muted/20 px-4 py-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Artifacts In Dashboard</p>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/artifacts/${dashboard.id}`}>Add Artifact</Link>
                    </Button>
                  </div>
                  {loadingItemsForDashboardId === dashboard.id ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading artifacts...
                    </div>
                  ) : (dashboardItems[dashboard.id] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No artifacts yet. Click Add Artifact to add one.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(dashboardItems[dashboard.id] || []).map((item) => {
                        const artifact = itemsArtifactLookup[item.childArtifactId];
                        return (
                          <div key={item.id} className="flex items-center justify-between rounded-md border bg-background px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm">{artifact?.name || item.childArtifactId}</p>
                              <p className="text-[11px] text-muted-foreground">{artifact?.type || 'artifact'}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              disabled={removingItemId === item.id}
                              onClick={() => void removeArtifactFromDashboard(dashboard.id, item.id)}
                            >
                              {removingItemId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Remove'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
              </div>
            ))}
          </div>
        </Card>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
