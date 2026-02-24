'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';

type ArtifactRun = {
  id: string;
  artifactId: string;
  status: string;
  triggerType: string;
  startedAt: string;
  completedAt?: string | null;
  resultMetaJson?: Record<string, unknown> | null;
  errorText?: string | null;
};

function ArtifactRunsPageContent() {
  const searchParams = useSearchParams();
  const selectedRunId = searchParams.get('id') || '';
  const [runs, setRuns] = useState<ArtifactRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/artifact-runs?limit=100');
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to load artifact runs');
        setRuns(payload.runs || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load runs');
        setRuns([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((run) => {
      return (
        run.id.toLowerCase().includes(q) ||
        run.artifactId.toLowerCase().includes(q) ||
        run.status.toLowerCase().includes(q) ||
        run.triggerType.toLowerCase().includes(q) ||
        (run.errorText || '').toLowerCase().includes(q)
      );
    });
  }, [runs, searchText]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Run History</h1>
          <p className="text-sm text-muted-foreground">Execution history for SQL-backed artifacts.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/artifacts">Back to Artifacts</Link>
        </Button>
      </div>

      <div className="relative w-full md:w-96">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search runs..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading runs...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">No runs found.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-3">Run</div>
            <div className="col-span-2">Artifact</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Trigger</div>
            <div className="col-span-2">Started</div>
            <div className="col-span-2">Completed</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          <div className="divide-y">
            {filtered.map((run) => (
              <div
                key={run.id}
                className={`grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm ${selectedRunId === run.id ? 'bg-primary/5' : ''}`}
              >
                <div className="col-span-3 min-w-0">
                  <p className="truncate font-medium">{run.id}</p>
                  {run.errorText ? <p className="truncate text-xs text-red-600 mt-0.5">{run.errorText}</p> : null}
                </div>
                <div className="col-span-2 min-w-0 text-xs text-muted-foreground truncate">{run.artifactId}</div>
                <div className="col-span-1">
                  <Badge variant={run.status === 'succeeded' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                    {run.status}
                  </Badge>
                </div>
                <div className="col-span-1">
                  <Badge variant="outline">{run.triggerType}</Badge>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {run.completedAt ? new Date(run.completedAt).toLocaleString() : '-'}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/artifact-runs?id=${encodeURIComponent(run.id)}`}>Inspect</Link>
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

export default function ArtifactRunsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading run history...</div>}>
      <ArtifactRunsPageContent />
    </Suspense>
  );
}
