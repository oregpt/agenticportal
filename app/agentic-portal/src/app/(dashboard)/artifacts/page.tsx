'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Play, PlusCircle } from 'lucide-react';

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

  const filtered = useMemo(() => artifacts, [artifacts]);

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
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading artifacts...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-sm text-muted-foreground">No artifacts yet. Use Project Agent Chat and click save buttons to create artifacts.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((artifact) => (
            <Card key={artifact.id}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/artifacts/${artifact.id}`} className="font-semibold hover:underline">{artifact.name}</Link>
                    <Badge variant="outline">{artifact.type}</Badge>
                    <Badge variant={artifact.status === 'active' ? 'default' : 'secondary'}>{artifact.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    v{artifact.latestVersion} · Updated {new Date(artifact.updatedAt).toLocaleString()}
                  </div>
                  {artifact.description ? <div className="text-sm text-muted-foreground mt-1">{artifact.description}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/artifacts/${artifact.id}`}>Open</Link>
                  </Button>
                  <Button size="sm" onClick={() => runArtifact(artifact.id)} disabled={runningId === artifact.id}>
                    {runningId === artifact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
