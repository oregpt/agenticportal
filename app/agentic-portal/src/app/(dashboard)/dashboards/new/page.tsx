'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LayoutDashboard, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface DataSourceOption {
  id: string;
  name: string;
}

interface ViewOption {
  id: string;
  name: string;
  dataSourceId: string;
}

interface WorkstreamOption {
  id: string;
  name: string;
}

function NewDashboardPageContent() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workstreamId, setWorkstreamId] = useState('');
  const [selectedDataSourceId, setSelectedDataSourceId] = useState('');
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>([]);

  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [views, setViews] = useState<ViewOption[]>([]);
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function fetchBaseData() {
      try {
        const [dataSourcesRes, viewsRes, workstreamsRes] = await Promise.all([
          fetch('/api/datasources'),
          fetch('/api/views'),
          fetch('/api/workstreams'),
        ]);

        const [dataSourcesData, viewsData, workstreamsData] = await Promise.all([
          dataSourcesRes.ok ? dataSourcesRes.json() : Promise.resolve({}),
          viewsRes.ok ? viewsRes.json() : Promise.resolve({}),
          workstreamsRes.ok ? workstreamsRes.json() : Promise.resolve({}),
        ]);

        const nextDataSources = (dataSourcesData?.dataSources || []).map((ds: { id: string; name: string }) => ({
          id: ds.id,
          name: ds.name,
        }));
        const nextViews = (viewsData?.views || []).map((view: { id: string; name: string; dataSourceId: string }) => ({
          id: view.id,
          name: view.name,
          dataSourceId: view.dataSourceId,
        }));
        const nextWorkstreams = (workstreamsData?.workstreams || []).map((ws: { id: string; name: string }) => ({
          id: ws.id,
          name: ws.name,
        }));

        setDataSources(nextDataSources);
        setViews(nextViews);
        setWorkstreams(nextWorkstreams);

        if (nextDataSources.length > 0) {
          setSelectedDataSourceId(nextDataSources[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchBaseData();
  }, []);

  const availableViews = useMemo(() => {
    if (!selectedDataSourceId) return [];
    return views.filter((view) => view.dataSourceId === selectedDataSourceId);
  }, [views, selectedDataSourceId]);

  useEffect(() => {
    setSelectedViewIds((prev) => prev.filter((id) => availableViews.some((view) => view.id === id)));
  }, [availableViews]);

  const canCreateDashboard = name.trim().length > 0;

  const handleToggleView = (viewId: string) => {
    setSelectedViewIds((prev) =>
      prev.includes(viewId) ? prev.filter((id) => id !== viewId) : [...prev, viewId]
    );
  };

  const handleCreate = async () => {
    if (!canCreateDashboard) return;
    setIsCreating(true);
    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          workstreamId: workstreamId || null,
          viewIds: selectedViewIds,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create dashboard');
      }

      toast({ title: 'Dashboard created', description: 'Your dashboard is ready to use.' });
      const contextIds = selectedViewIds.length > 0 ? selectedViewIds : availableViews.map((view) => view.id);
      if (typeof window !== 'undefined' && contextIds.length > 0) {
        window.localStorage.setItem(`dashboard-source-views:${payload.dashboard.id}`, JSON.stringify(contextIds));
      }
      router.push(`/dashboards/${payload.dashboard.id}`);
    } catch (error) {
      toast({
        title: 'Could not create dashboard',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboards">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Dashboard</h1>
          <p className="text-muted-foreground">Choose available sources, then add widgets manually.</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard Details
          </CardTitle>
          <CardDescription>Name your dashboard and choose an optional project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Dashboard Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Weekly Sales Overview"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What should this dashboard track?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workstream">Project (optional)</Label>
            <select
              id="workstream"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={workstreamId}
              onChange={(e) => setWorkstreamId(e.target.value)}
            >
              <option value="">No project</option>
              {workstreams.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Quick Setup
          </CardTitle>
          <CardDescription>Select the data context this dashboard should pull from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dataSources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No data sources found. Connect one first in{' '}
              <Link href="/datasources" className="text-primary underline underline-offset-4">
                Data Sources
              </Link>
              .
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="data-source">Data Source</Label>
                <select
                  id="data-source"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedDataSourceId}
                  onChange={(e) => setSelectedDataSourceId(e.target.value)}
                >
                  {dataSources.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Views (optional source context)</Label>
                {availableViews.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No views for this data source yet. Create one in{' '}
                    <Link href="/views/new?mode=chat" className="text-primary underline underline-offset-4">
                      Views
                    </Link>
                    .
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Selecting these does not create widgets automatically. You will choose widgets on the dashboard screen.
                    </p>
                    {availableViews.map((view) => (
                      <label
                        key={view.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <span>{view.name}</span>
                        <input
                          type="checkbox"
                          checked={selectedViewIds.includes(view.id)}
                          onChange={() => handleToggleView(view.id)}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            What happens next
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li>- A dashboard shell will be created with your selected context.</li>
            <li>- Add and remove widgets manually from available sources.</li>
          </ul>
          <div className="flex justify-end gap-3">
            <Link href="/dashboards">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleCreate} disabled={!canCreateDashboard || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Dashboard'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-4xl mx-auto text-muted-foreground">Loading dashboard setup...</div>}>
      <NewDashboardPageContent />
    </Suspense>
  );
}


