'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { MultiSelectDropdown } from '@/components/filters/MultiSelectDropdown';
import { FilterPresetManager } from '@/components/filters/FilterPresetManager';
import { Plus, LayoutDashboard, Clock, Network } from 'lucide-react';
import Link from 'next/link';

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  workstreamId?: string | null;
  widgetCount?: number;
}

interface WorkstreamOption {
  id: string;
  name: string;
}

function DashboardsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const selectedWorkstreamId = searchParams.get('workstreamId') || undefined;
  const selectedWidgetStates = (searchParams.get('widgetStates') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  useEffect(() => {
    const fetchWorkstreams = async () => {
      try {
        const res = await fetch('/api/workstreams');
        if (!res.ok) return;
        const data = await res.json();
        setWorkstreams((data.workstreams || []).map((ws: { id: string; name: string }) => ({ id: ws.id, name: ws.name })));
      } catch (error) {
        console.error('Failed to fetch workstreams:', error);
      }
    };

    fetchWorkstreams();
  }, []);

  useEffect(() => {
    const fetchDashboards = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedWorkstreamId) {
          params.set('workstreamId', selectedWorkstreamId);
        }
        const query = params.toString();
        const res = await fetch(`/api/dashboards${query ? `?${query}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          setDashboards(data.dashboards || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboards:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboards();
  }, [selectedWorkstreamId]);

  const filteredDashboards = useMemo(() => {
    if (selectedWidgetStates.length === 0) return dashboards;
    return dashboards.filter((dashboard) => {
      const hasWidgets = Number(dashboard.widgetCount || 0) > 0;
      return (
        (hasWidgets && selectedWidgetStates.includes('withWidgets')) ||
        (!hasWidgets && selectedWidgetStates.includes('empty'))
      );
    });
  }, [dashboards, selectedWidgetStates]);

  const updateFilterParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.replace(`/dashboards${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const updateMultiFilterParam = (key: string, values: string[]) => {
    const next = new URLSearchParams(searchParams.toString());
    if (values.length === 0) {
      next.delete(key);
    } else {
      next.set(key, values.join(','));
    }
    router.replace(`/dashboards${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const applyPreset = (query: string) => {
    router.replace(`/dashboards${query ? `?${query}` : ''}`, { scroll: false });
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboards</h1>
          <p className="text-muted-foreground mt-1">Create and manage your data dashboards</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/relationship-explorer">
              <Network className="w-4 h-4 mr-2" />
              Relationship Explorer
            </Link>
          </Button>
          <Button className="bg-primary hover:bg-primary/90" asChild>
            <Link href="/dashboards/new">
              <Plus className="w-4 h-4 mr-2" />
              New Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={(value) => updateFilterParam('workstreamId', value)}
        rightSlot={
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-end">
            <div className="w-full md:w-64">
              <MultiSelectDropdown
                label="Widget State"
                options={[
                  { value: 'withWidgets', label: 'With widgets' },
                  { value: 'empty', label: 'Empty' },
                ]}
                selectedValues={selectedWidgetStates}
                onChange={(values) => updateMultiFilterParam('widgetStates', values)}
                emptyLabel="All dashboards"
              />
            </div>
            <FilterPresetManager
              pageKey="dashboards"
              currentQuery={searchParams.toString()}
              onApply={applyPreset}
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="text-muted-foreground">Loading dashboards...</div>
      ) : filteredDashboards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDashboards.map((dashboard) => (
            <Link key={dashboard.id} href={`/dashboards/${dashboard.id}`}>
              <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer h-full">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{dashboard.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{dashboard.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                  <span>{Number(dashboard.widgetCount || 0)} widgets</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(dashboard.updatedAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-dashed border-border rounded-xl p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <LayoutDashboard className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No dashboards found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Try changing filters or create a new dashboard.</p>
            <Button className="bg-primary hover:bg-primary/90" asChild>
              <Link href="/dashboards/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Dashboard
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardsPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-7xl mx-auto text-muted-foreground">Loading dashboards...</div>}>
      <DashboardsPageContent />
    </Suspense>
  );
}
