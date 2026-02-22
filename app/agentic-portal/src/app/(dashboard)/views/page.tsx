'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { MultiSelectDropdown } from '@/components/filters/MultiSelectDropdown';
import { FilterPresetManager } from '@/components/filters/FilterPresetManager';
import { Table2, Search, Code, MessageSquare, Database, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface View {
  id: string;
  name: string;
  description: string | null;
  workstreamId?: string | null;
  dataSourceId: string;
  sql: string;
  columns: { name: string; type: string }[];
  createdAt: string;
  updatedAt: string;
}

interface WorkstreamOption {
  id: string;
  name: string;
}

interface DataSourceOption {
  id: string;
  name: string;
}

function ViewsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [views, setViews] = useState<View[]>([]);
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedWorkstreamId = searchParams.get('workstreamId') || undefined;
  const selectedDataSourceIds = (searchParams.get('dataSourceIds') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [workstreamsRes, dataSourcesRes] = await Promise.all([
          fetch('/api/workstreams'),
          fetch('/api/datasources'),
        ]);

        if (workstreamsRes.ok) {
          const wsData = await workstreamsRes.json();
          setWorkstreams((wsData.workstreams || []).map((ws: { id: string; name: string }) => ({ id: ws.id, name: ws.name })));
        }

        if (dataSourcesRes.ok) {
          const dsData = await dataSourcesRes.json();
          setDataSources((dsData.dataSources || []).map((ds: { id: string; name: string }) => ({ id: ds.id, name: ds.name })));
        }
      } catch (error) {
        console.error('Failed to fetch filter data:', error);
      }
    };

    fetchBaseData();
  }, []);

  useEffect(() => {
    const fetchViews = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedWorkstreamId) {
          params.set('workstreamId', selectedWorkstreamId);
        }
        const query = params.toString();
        const response = await fetch(`/api/views${query ? `?${query}` : ''}`);
        if (response.ok) {
          const data = await response.json();
          setViews(data.views || []);
        }
      } catch (error) {
        console.error('Failed to fetch views:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchViews();
  }, [selectedWorkstreamId]);

  const dataSourceNameById = useMemo(
    () => Object.fromEntries(dataSources.map((ds) => [ds.id, ds.name])),
    [dataSources]
  );

  const filteredViews = views.filter((view) => {
    const matchesSearch =
      view.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (view.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesDataSource =
      selectedDataSourceIds.length === 0 || selectedDataSourceIds.includes(view.dataSourceId);
    return matchesSearch && matchesDataSource;
  });

  const filteredDataSourceOptions = useMemo(() => {
    const idsInScope = new Set(views.map((view) => view.dataSourceId));
    return dataSources.filter((ds) => idsInScope.has(ds.id));
  }, [views, dataSources]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const updateMultiFilterParam = (key: string, values: string[]) => {
    const next = new URLSearchParams(searchParams.toString());
    if (values.length === 0) {
      next.delete(key);
    } else {
      next.set(key, values.join(','));
    }
    router.replace(`/views${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const applyPreset = (query: string) => {
    router.replace(`/views${query ? `?${query}` : ''}`, { scroll: false });
  };

  const handleWorkstreamChange = (value: string | undefined) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') {
      next.delete('workstreamId');
    } else {
      next.set('workstreamId', value);
    }
    next.delete('dataSourceIds');
    router.replace(`/views${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in-up">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Views</h1>
          <p className="text-muted-foreground mt-1">Views ready to reuse in dashboards</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild className="hover:bg-primary/5 hover:text-primary hover:border-primary/30">
            <Link href="/views/new?mode=sql">
              <Code className="w-4 h-4 mr-2" />
              Write SQL
            </Link>
          </Button>
          <Button className="bg-primary hover:bg-primary/90" asChild>
            <Link href="/chat">
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask Assistant
            </Link>
          </Button>
        </div>
      </div>

      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={handleWorkstreamChange}
        pageLabel="Views"
        rightSlot={
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-end">
            <div className="w-full md:w-72">
              <MultiSelectDropdown
                label="Data Source"
                options={filteredDataSourceOptions.map((ds) => ({ value: ds.id, label: ds.name }))}
                selectedValues={selectedDataSourceIds}
                onChange={(values) => updateMultiFilterParam('dataSourceIds', values)}
                emptyLabel="All data sources"
              />
            </div>
            <FilterPresetManager
              pageKey="views"
              currentQuery={searchParams.toString()}
              onApply={applyPreset}
            />
          </div>
        }
      />

      <div className="relative mb-6 fade-in-up-delay-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search views..."
          className="pl-10 max-w-md border-border bg-white/80 rounded-xl shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : dataSources.length === 0 ? (
        <div className="ui-empty fade-in-up-delay-2">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Database className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Connect data first</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Once a data source is connected, you can save views and build dashboards.
            </p>
            <Button asChild>
              <Link href="/datasources">Connect Data Source</Link>
            </Button>
          </div>
        </div>
      ) : filteredViews.length === 0 && views.length === 0 ? (
        <div className="ui-empty fade-in-up-delay-2">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Table2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No views yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Create your first view by asking AI or writing SQL</p>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/views/new?mode=sql">
                  <Code className="w-4 h-4 mr-2" />
                  Write SQL
                </Link>
              </Button>
              <Button className="bg-primary hover:bg-primary/90" asChild>
                <Link href="/chat">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Ask Assistant
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : filteredViews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No views match your filters</div>
      ) : (
        <div className="space-y-4">
          {filteredViews.map((view) => (
            <Link key={view.id} href={`/views/${view.id}`}>
              <div className="ui-card ui-card-hover p-5 cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Table2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{view.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{view.description || 'No description'}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5" />
                          {dataSourceNameById[view.dataSourceId] || view.dataSourceId}
                        </span>
                        <span>{Array.isArray(view.columns) ? view.columns.length : 0} columns</span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(view.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    <Code className="w-3 h-3 mr-1" /> SQL View
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ViewsPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-7xl mx-auto text-muted-foreground">Loading views...</div>}>
      <ViewsPageContent />
    </Suspense>
  );
}

