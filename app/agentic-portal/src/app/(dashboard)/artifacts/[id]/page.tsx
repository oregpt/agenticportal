'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play } from 'lucide-react';

type ArtifactDetails = {
  artifact: {
    id: string;
    name: string;
    type: string;
    status: string;
    description?: string | null;
    latestVersion: number;
    updatedAt: string;
  };
  versions: Array<{
    id: string;
    version: number;
    querySpecId?: string | null;
    configJson?: Record<string, unknown> | null;
    layoutJson?: Record<string, unknown> | null;
    notes?: string | null;
    createdAt: string;
  }>;
};

export default function ArtifactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const artifactId = params.id;
  const [data, setData] = useState<ArtifactDetails | null>(null);
  const [runs, setRuns] = useState<Array<any>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    if (!artifactId) return;
    setIsLoading(true);
    setError('');
    try {
      const [artifactRes, runsRes] = await Promise.all([
        fetch(`/api/artifacts/${artifactId}`),
        fetch(`/api/artifact-runs?artifactId=${artifactId}&limit=20`),
      ]);
      const artifactPayload = await artifactRes.json().catch(() => ({}));
      const runsPayload = await runsRes.json().catch(() => ({}));
      if (!artifactRes.ok) throw new Error(artifactPayload?.error || 'Failed to load artifact');
      setData(artifactPayload);
      setRuns(runsPayload?.runs || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load artifact');
      setData(null);
      setRuns([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [artifactId]);

  async function runNow() {
    if (!artifactId) return;
    setIsRunning(true);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ triggerType: 'manual' }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to run artifact');
      await refresh();
      router.push('/artifact-runs');
    } catch (e: any) {
      setError(e?.message || 'Failed to run artifact');
    } finally {
      setIsRunning(false);
    }
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading artifact...</div>;
  if (!data) return <div className="p-8 text-sm text-red-600">{error || 'Artifact not found'}</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{data.artifact.name}</h1>
            <Badge variant="outline">{data.artifact.type}</Badge>
            <Badge variant={data.artifact.status === 'active' ? 'default' : 'secondary'}>{data.artifact.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Latest version: v{data.artifact.latestVersion}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.artifact.type === 'dashboard' ? (
            <Button asChild variant="outline">
              <Link href={`/artifacts/${artifactId}/compose`}>Compose Dashboard</Link>
            </Button>
          ) : null}
          <Button onClick={runNow} disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Versions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions found.</p>
          ) : data.versions.map((v) => (
            <div key={v.id} className="rounded-md border border-border p-3">
              <div className="text-sm font-medium">v{v.version}</div>
              <div className="text-xs text-muted-foreground">Created {new Date(v.createdAt).toLocaleString()}</div>
              {v.querySpecId ? <div className="text-xs mt-1"><strong>Query Spec:</strong> {v.querySpecId}</div> : null}
              {v.configJson ? <pre className="mt-2 rounded bg-slate-950 text-slate-100 p-2 text-[11px] overflow-x-auto">{JSON.stringify(v.configJson, null, 2)}</pre> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : runs.map((r) => (
            <Link key={r.id} href={`/artifact-runs?id=${encodeURIComponent(r.id)}`} className="block rounded-md border border-border p-2 hover:bg-muted/50">
              <div className="text-sm font-medium">{r.status} - {new Date(r.startedAt).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{r.triggerType} - {r.id}</div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

