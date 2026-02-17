'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  FileOutput,
  FileText,
  Download,
  Calendar,
  Clock,
  Mail,
  Search,
  Webhook,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { MultiSelectDropdown } from '@/components/filters/MultiSelectDropdown';
import { FilterPresetManager } from '@/components/filters/FilterPresetManager';
import { useToast } from '@/hooks/use-toast';

interface Output {
  id: string;
  name: string;
  type: 'pdf' | 'csv' | 'email' | 'webhook' | 'report' | string;
  schedule?: string;
  lastRunAt?: string;
  status: 'active' | 'paused' | 'error' | string;
  workstreamId?: string | null;
  dashboardId?: string;
}

interface WorkstreamOption {
  id: string;
  name: string;
}

interface DashboardOption {
  id: string;
  name: string;
}

const outputTypeConfig: Record<string, { icon: typeof FileText; color: string; bg: string; border: string; label: string }> = {
  report: { icon: FileText, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', label: 'PDF Report' },
  pdf: { icon: FileText, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', label: 'PDF Report' },
  csv: { icon: Download, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'CSV Export' },
  email: { icon: Mail, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Email' },
  webhook: { icon: Webhook, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Webhook' },
};

const scheduleLabel = (value?: string) => {
  const schedule = value || 'on_demand';
  if (schedule === 'manual' || schedule === 'on_demand') return 'On-demand';
  return schedule.charAt(0).toUpperCase() + schedule.slice(1);
};

function OutputsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [outputs, setOutputs] = useState<Output[]>([]);
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedWorkstreamId = searchParams.get('workstreamId') || undefined;
  const selectedDashboardIds = (searchParams.get('dashboardIds') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const wsRes = await fetch('/api/workstreams');
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          setWorkstreams((wsData.workstreams || []).map((ws: { id: string; name: string }) => ({ id: ws.id, name: ws.name })));
        }
      } catch (error) {
        console.error('Failed to fetch workstreams:', error);
      }
    };

    fetchBaseData();
  }, []);

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedWorkstreamId) {
          params.set('workstreamId', selectedWorkstreamId);
        }
        const query = params.toString();
        const res = await fetch(`/api/dashboards${query ? `?${query}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          setDashboards((data.dashboards || []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
        }
      } catch (error) {
        console.error('Failed to fetch dashboards:', error);
      }
    };

    fetchDashboards();
  }, [selectedWorkstreamId]);

  useEffect(() => {
    const fetchOutputs = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (selectedWorkstreamId) {
          params.set('workstreamId', selectedWorkstreamId);
        }
        const query = params.toString();
        const res = await fetch(`/api/outputs${query ? `?${query}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          setOutputs(data.outputs || []);
        } else {
          setOutputs([]);
          setLoadError('Could not load outputs. Please refresh and try again.');
        }
      } catch (error) {
        console.error('Failed to fetch outputs:', error);
        setLoadError('Could not load outputs. Please refresh and try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOutputs();
  }, [selectedWorkstreamId]);

  const dashboardNameById = useMemo(
    () => Object.fromEntries(dashboards.map((dashboard) => [dashboard.id, dashboard.name])),
    [dashboards]
  );

  const filteredOutputs = outputs.filter((output) => {
    const matchesSearch = output.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDashboard =
      selectedDashboardIds.length === 0 ||
      (output.dashboardId ? selectedDashboardIds.includes(output.dashboardId) : false);
    return matchesSearch && matchesDashboard;
  });

  const updateFilterParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.replace(`/outputs${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const updateMultiFilterParam = (key: string, values: string[]) => {
    const next = new URLSearchParams(searchParams.toString());
    if (values.length === 0) {
      next.delete(key);
    } else {
      next.set(key, values.join(','));
    }
    router.replace(`/outputs${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const applyPreset = (query: string) => {
    router.replace(`/outputs${query ? `?${query}` : ''}`, { scroll: false });
  };

  useEffect(() => {
    if (selectedDashboardIds.length === 0 || dashboards.length === 0) return;
    const availableIds = new Set(dashboards.map((dashboard) => dashboard.id));
    const nextIds = selectedDashboardIds.filter((id) => availableIds.has(id));
    if (nextIds.length !== selectedDashboardIds.length) {
      updateMultiFilterParam('dashboardIds', nextIds);
    }
  }, [dashboards, selectedDashboardIds]);

  const formatLastRun = (value?: string) => {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  };

  const handleDeleteOutput = async (output: Output) => {
    const confirmed = window.confirm(`Delete output "${output.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(output.id);
    try {
      const res = await fetch(`/api/outputs/${output.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete output');
      }
      setOutputs((prev) => prev.filter((item) => item.id !== output.id));
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'agenticportal:entity-deleted',
            entityType: 'output',
            id: output.id,
          },
          window.location.origin
        );
      }
      toast({ title: 'Output deleted' });
    } catch (error) {
      toast({
        title: 'Could not delete output',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    router.replace('/outputs', { scroll: false });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in-up">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Outputs</h1>
          <p className="text-muted-foreground">
            Scheduled reports, exports, and automated notifications
          </p>
        </div>
        <Button className="gap-2" disabled>
          <Plus className="w-4 h-4" />
          New Output
        </Button>
      </div>

      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={(value) => {
          updateFilterParam('workstreamId', value);
          updateMultiFilterParam('dashboardIds', []);
        }}
        rightSlot={
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-end">
            <div className="w-full md:w-72">
              <MultiSelectDropdown
                label="Dashboard"
                options={dashboards.map((dashboard) => ({ value: dashboard.id, label: dashboard.name }))}
                selectedValues={selectedDashboardIds}
                onChange={(values) => updateMultiFilterParam('dashboardIds', values)}
                emptyLabel="All dashboards"
              />
            </div>
            <FilterPresetManager
              pageKey="outputs"
              currentQuery={searchParams.toString()}
              onApply={applyPreset}
            />
          </div>
        }
      />

      <div className="relative mb-6 fade-in-up-delay-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search outputs..."
          className="pl-10"
        />
      </div>

      {outputs.length > 0 ? (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredOutputs.length} of {outputs.length} outputs
        </div>
      ) : null}

      {loadError ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-muted-foreground">Loading outputs...</div>
      ) : (
        <div className="grid gap-4">
          {filteredOutputs.map((output) => {
            const config = outputTypeConfig[output.type] || outputTypeConfig.webhook;
            const Icon = config.icon;

            return (
              <div
                key={output.id}
                className="group ui-card ui-card-hover p-5 cursor-pointer"
                onClick={() => router.push(`/outputs/${output.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/outputs/${output.id}`);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${config.bg} ${config.border} border`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-medium">{output.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                          {output.status === 'paused' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                              Paused
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Dashboard: {output.dashboardId ? (dashboardNameById[output.dashboardId] || output.dashboardId) : 'Unlinked'}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {scheduleLabel(output.schedule)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Last run: {formatLastRun(output.lastRunAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOutput(output);
                      }}
                      disabled={deletingId === output.id}
                      aria-label={`Delete output ${output.name}`}
                    >
                      {deletingId === output.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filteredOutputs.length === 0 ? (
        <div className="ui-empty mt-2 fade-in-up-delay-2">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
            <FileOutput className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">{outputs.length > 0 ? 'No outputs match current filters' : 'No outputs found'}</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery
              ? 'Try adjusting your search'
              : outputs.length > 0
                ? 'Clear filters to see available outputs.'
                : 'Outputs let you export dashboards as reports, CSVs, or automated emails.'}
          </p>
          {outputs.length > 0 ? (
            <Button variant="outline" onClick={clearAllFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function OutputsPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-7xl mx-auto text-muted-foreground">Loading outputs...</div>}>
      <OutputsPageContent />
    </Suspense>
  );
}
