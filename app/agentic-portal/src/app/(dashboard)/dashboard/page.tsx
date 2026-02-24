'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LayoutDashboard, Loader2, PlusCircle, Search, Trash2 } from 'lucide-react';

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

export default function DashboardEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dashboards, setDashboards] = useState<DashboardArtifact[]>([]);
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
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

  const createHref = selectedWorkstreamId
    ? `/project-agent/chat?projectId=${encodeURIComponent(selectedWorkstreamId)}`
    : '/project-agent/chat';

  return (
    <div className="p-8 space-y-6">
      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={handleWorkstreamChange}
        pageLabel="Dashboard"
        pageDescription="Manage dashboard artifacts and their visual compositions by project."
        rightSlot={
          <Button asChild>
            <Link href={createHref}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Dashboard
            </Link>
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
          <CardContent className="py-10 text-sm text-muted-foreground">No dashboards yet. Create one from Project Agent chat.</CardContent>
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
              <div key={dashboard.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
                <div className="col-span-5 min-w-0">
                  <Link href={`/artifacts/${dashboard.id}`} className="truncate font-medium hover:underline inline-flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    {dashboard.name}
                  </Link>
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
                    <Link href={`/artifacts/${dashboard.id}/compose`}>Compose</Link>
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
            ))}
          </div>
        </Card>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
