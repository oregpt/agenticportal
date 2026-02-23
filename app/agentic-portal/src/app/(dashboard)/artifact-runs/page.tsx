'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Run History</h1>
          <p className="text-sm text-muted-foreground">Execution history for SQL-backed artifacts.</p>
        </div>
        <Button asChild variant="outline"><Link href="/artifacts">Back to Artifacts</Link></Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading runs...</p>
      ) : runs.length === 0 ? (
        <Card><CardContent className="py-10 text-sm text-muted-foreground">No runs found.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {runs.map((run) => (
            <Card key={run.id} className={selectedRunId === run.id ? 'ring-2 ring-primary/50' : ''}>
              <CardContent className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{run.id}</span>
                    <Badge variant={run.status === 'succeeded' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>{run.status}</Badge>
                    <Badge variant="outline">{run.triggerType}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    artifact {run.artifactId} · started {new Date(run.startedAt).toLocaleString()}
                    {run.completedAt ? ` · completed ${new Date(run.completedAt).toLocaleString()}` : ''}
                  </div>
                  {run.errorText ? <div className="text-xs text-red-600 mt-1">{run.errorText}</div> : null}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/artifact-runs?id=${encodeURIComponent(run.id)}`}>Inspect</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
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
