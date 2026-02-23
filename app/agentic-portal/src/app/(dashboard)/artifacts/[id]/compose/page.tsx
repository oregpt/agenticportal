'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Artifact = { id: string; name: string; type: string; projectId: string };
type DashboardItem = {
  id: string;
  childArtifactId: string;
  childArtifactVersionId?: string | null;
  positionJson?: Record<string, unknown> | null;
  displayJson?: Record<string, unknown> | null;
};

export default function DashboardComposePage() {
  const params = useParams<{ id: string }>();
  const dashboardId = params.id;
  const [allArtifacts, setAllArtifacts] = useState<Artifact[]>([]);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [aRes, itemRes] = await Promise.all([
          fetch('/api/artifacts'),
          fetch(`/api/artifacts/${dashboardId}/items`),
        ]);
        const aPayload = await aRes.json().catch(() => ({}));
        const iPayload = await itemRes.json().catch(() => ({}));
        if (!aRes.ok) throw new Error(aPayload?.error || 'Failed to load artifacts');
        if (!itemRes.ok) throw new Error(iPayload?.error || 'Failed to load dashboard items');
        setAllArtifacts((aPayload.artifacts || []).filter((a: Artifact) => a.id !== dashboardId && a.type !== 'dashboard'));
        setItems(iPayload.items || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load compose view');
      }
    })();
  }, [dashboardId]);

  const artifactMap = useMemo(() => new Map(allArtifacts.map((a) => [a.id, a])), [allArtifacts]);

  async function addItem() {
    if (!selectedArtifactId) return;
    try {
      const res = await fetch(`/api/artifacts/${dashboardId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childArtifactId: selectedArtifactId,
          displayJson: titleOverride ? { title: titleOverride } : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to add item');
      setItems((prev) => [...prev, payload.item]);
      setSelectedArtifactId('');
      setTitleOverride('');
    } catch (e: any) {
      setError(e?.message || 'Failed to add item');
    }
  }

  async function removeItem(itemId: string) {
    try {
      const res = await fetch(`/api/artifacts/${dashboardId}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to remove item');
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (e: any) {
      setError(e?.message || 'Failed to remove item');
    }
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Compose Dashboard</h1>

      <Card>
        <CardHeader><CardTitle>Add Artifact Block</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedArtifactId}
            onChange={(e) => setSelectedArtifactId(e.target.value)}
          >
            <option value="">Select artifact</option>
            {allArtifacts.map((artifact) => (
              <option key={artifact.id} value={artifact.id}>{artifact.name} ({artifact.type})</option>
            ))}
          </select>
          <Input placeholder="Optional title override" value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)} />
          <Button onClick={addItem} disabled={!selectedArtifactId}>Add to Dashboard</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current Blocks</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks yet.</p>
          ) : (
            items.map((item) => {
              const artifact = artifactMap.get(item.childArtifactId);
              return (
                <div key={item.id} className="rounded-md border border-border p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{artifact?.name || item.childArtifactId}</div>
                    <div className="text-xs text-muted-foreground">{artifact?.type || 'artifact'} · item {item.id}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => removeItem(item.id)}>Remove</Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
