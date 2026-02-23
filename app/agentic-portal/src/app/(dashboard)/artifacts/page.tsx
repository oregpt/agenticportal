'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Play, PlusCircle, Search, Trash2 } from 'lucide-react';

type ArtifactType = 'table' | 'chart' | 'dashboard' | 'report' | 'kpi';
type WorkstreamOption = { id: string; name: string };
type Artifact = {
  id: string;
  projectId: string;
  name: string;
  type: ArtifactType;
  description?: string | null;
  status: 'active' | 'archived';
  latestVersion: number;
  updatedAt: string;
};

const TYPE_LABELS: Array<{ value: ArtifactType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'table', label: 'Tables' },
  { value: 'chart', label: 'Charts' },
  { value: 'dashboard', label: 'Dashboards' },
  { value: 'report', label: 'Reports' },
  { value: 'kpi', label: 'KPIs' },
];

function ArtifactsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState('');
  const [selectedType, setSelectedType] = useState<ArtifactType | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [runningId, setRunningId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [searchText, setSearchText] = useState('');
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
        const params = new URLSearchParams();
        if (selectedWorkstreamId) params.set('projectId', selectedWorkstreamId);
        if (selectedType !== 'all') params.set('type', selectedType);
        const res = await fetch(`/api/artifacts${params.toString() ? `?${params.toString()}` : ''}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load artifacts');
        setArtifacts(data.artifacts || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load artifacts');
        setArtifacts([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedWorkstreamId, selectedType]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return artifacts;
    return artifacts.filter((artifact) => {
      return (
        artifact.name.toLowerCase().includes(q) ||
        artifact.type.toLowerCase().includes(q) ||
        (artifact.description || '').toLowerCase().includes(q)
      );
    });
  }, [artifacts, searchText]);

  const handleWorkstreamChange = (value: string | undefined) => {
    setSelectedWorkstreamId(value || '');
  };

  async function runArtifact(artifactId: string) {
    try {
      setRunningId(artifactId);
      const res = await fetch(`/api/artifacts/${artifactId}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ triggerType: 'manual' }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to run artifact');
      router.push('/artifact-runs');
    } catch (e: any) {
      setError(e?.message || 'Failed to run artifact');
    } finally {
      setRunningId('');
    }
  }

  async function deleteArtifactRow(artifact: Artifact) {
    const ok = window.confirm(`Delete artifact "${artifact.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      setDeletingId(artifact.id);
      const res = await fetch(`/api/artifacts/${artifact.id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to delete artifact');
      setArtifacts((prev) => prev.filter((a) => a.id !== artifact.id));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete artifact');
    } finally {
      setDeletingId('');
    }
  }

  return (
    <div className="p-8 space-y-6">
      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={handleWorkstreamChange}
        pageLabel="Artifacts"
        pageDescription="Agent-produced SQL-backed assets (tables, charts, dashboards, reports, KPIs)."
        rightSlot={
          <Button asChild>
            <Link href="/project-agent/chat">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create From Chat
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {TYPE_LABELS.map((opt) => (
          <Button key={opt.value} variant={selectedType === opt.value ? 'default' : 'outline'} size="sm" onClick={() => setSelectedType(opt.value)}>
            {opt.label}
          </Button>
        ))}
        <div className="relative ml-auto w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search artifacts..."
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading artifacts...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-sm text-muted-foreground">No artifacts yet. Use Project Agent Chat and click save buttons to create artifacts.</CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-1">Version</div>
            <div className="col-span-2">Updated</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y">
            {filtered.map((artifact) => (
              <div key={artifact.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
                <div className="col-span-4 min-w-0">
                  <Link href={`/artifacts/${artifact.id}`} className="truncate font-medium hover:underline">
                    {artifact.name}
                  </Link>
                  {artifact.description ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{artifact.description}</p>
                  ) : null}
                </div>
                <div className="col-span-2">
                  <Badge variant="outline">{artifact.type}</Badge>
                </div>
                <div className="col-span-1 text-muted-foreground">v{artifact.latestVersion}</div>
                <div className="col-span-2 text-xs text-muted-foreground">{new Date(artifact.updatedAt).toLocaleString()}</div>
                <div className="col-span-1">
                  <Badge variant={artifact.status === 'active' ? 'default' : 'secondary'}>{artifact.status}</Badge>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/artifacts/${artifact.id}`}>Open</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runArtifact(artifact.id)} disabled={runningId === artifact.id}>
                    {runningId === artifact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteArtifactRow(artifact)}
                    disabled={deletingId === artifact.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    {deletingId === artifact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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

export default function ArtifactsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading artifacts...</div>}>
      <ArtifactsPageContent />
    </Suspense>
  );
}

