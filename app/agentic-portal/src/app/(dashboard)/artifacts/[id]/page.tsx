'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GridLayout, { type Layout } from 'react-grid-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Plus, Settings, Trash2, GripVertical } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Artifact = {
  id: string;
  name: string;
  type: 'table' | 'chart' | 'dashboard' | 'report' | 'kpi';
  status: string;
  description?: string | null;
  latestVersion: number;
  projectId: string;
  updatedAt: string;
};

type ArtifactVersion = {
  id: string;
  version: number;
  querySpecId?: string | null;
  configJson?: Record<string, any> | null;
  layoutJson?: Record<string, any> | null;
  notes?: string | null;
  createdAt: string;
};

type ArtifactDetails = {
  artifact: Artifact;
  versions: ArtifactVersion[];
  latestVersion?: ArtifactVersion | null;
};

type DashboardItem = {
  id: string;
  dashboardArtifactId: string;
  childArtifactId: string;
  childArtifactVersionId?: string | null;
  positionJson?: Record<string, any> | null;
  displayJson?: Record<string, any> | null;
};

type ChildBlock = {
  item: DashboardItem;
  artifact: Artifact;
  version: ArtifactVersion | null;
  rows: Array<Record<string, unknown>>;
};

type DataSourceOption = {
  id: string;
  name: string;
  type: string;
};

const CHART_COLORS = ['#0f766e', '#2563eb', '#9333ea', '#ea580c', '#dc2626'];

function normalizePosition(position: Record<string, any> | null | undefined, index: number): {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return {
    i: String(index),
    x: Number(position?.x ?? 0),
    y: Number(position?.y ?? index * 4),
    w: Number(position?.w ?? 12),
    h: Number(position?.h ?? 6),
  };
}

function pickChartConfig(config: Record<string, any> | null | undefined, rows: Array<Record<string, unknown>>) {
  const first = rows[0] || {};
  const keys = Object.keys(first);
  const numericKeys = keys.filter((k) => typeof first[k] === 'number');
  const xField = String(config?.xField || keys[0] || 'x');
  const yFromArray = Array.isArray(config?.yFields)
    ? config.yFields.map((y: any, idx: number) => ({ field: String(y.field || ''), color: CHART_COLORS[idx % CHART_COLORS.length] })).filter((y: any) => y.field)
    : [];
  const yFromSingle = config?.yField ? [{ field: String(config.yField), color: CHART_COLORS[0] }] : [];
  const yFields = yFromArray.length ? yFromArray : yFromSingle.length ? yFromSingle : (numericKeys[0] ? [{ field: numericKeys[0], color: CHART_COLORS[0] }] : []);
  const chartType = ['bar', 'line', 'area', 'pie'].includes(String(config?.chartType || '')) ? String(config?.chartType) : 'bar';
  return { xField, yFields, chartType };
}

function metricValue(config: Record<string, any> | null | undefined, rows: Array<Record<string, unknown>>) {
  const aggregation = String(config?.aggregation || 'count');
  const field = String(config?.metricField || '');

  if (aggregation === 'count' && !field) return `${rows.length}`;

  const values = rows
    .map((r) => r[field])
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => Number.isFinite(v));

  if (!values.length) return rows.length ? 'N/A' : '0';

  if (aggregation === 'sum') return values.reduce((a, b) => a + b, 0).toLocaleString();
  if (aggregation === 'avg') return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  if (aggregation === 'min') return `${Math.min(...values)}`;
  if (aggregation === 'max') return `${Math.max(...values)}`;
  return `${values.length}`;
}

export default function ArtifactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const artifactId = params.id;

  const [data, setData] = useState<ArtifactDetails | null>(null);
  const [runs, setRuns] = useState<Array<any>>([]);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [blocks, setBlocks] = useState<Record<string, ChildBlock>>({});
  const [allArtifacts, setAllArtifacts] = useState<Artifact[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [addMode, setAddMode] = useState<'existing' | 'direct'>('existing');
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [directType, setDirectType] = useState<'table' | 'chart' | 'kpi'>('chart');
  const [directName, setDirectName] = useState('');
  const [directDescription, setDirectDescription] = useState('');
  const [directSourceId, setDirectSourceId] = useState('');
  const [directSqlText, setDirectSqlText] = useState('');
  const [directChartType, setDirectChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');
  const [directChartXField, setDirectChartXField] = useState('');
  const [directChartYField, setDirectChartYField] = useState('');
  const [directMetricField, setDirectMetricField] = useState('');
  const [directMetricAggregation, setDirectMetricAggregation] = useState<'count' | 'sum' | 'avg' | 'min' | 'max'>('count');
  const [directTableColumns, setDirectTableColumns] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editChartType, setEditChartType] = useState('bar');
  const [editChartXField, setEditChartXField] = useState('');
  const [editChartYField, setEditChartYField] = useState('');
  const [editMetricField, setEditMetricField] = useState('');
  const [editMetricAggregation, setEditMetricAggregation] = useState('count');
  const [editTableColumns, setEditTableColumns] = useState('');
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [error, setError] = useState('');

  const dashboardLayouts = useMemo(() => {
    return items.map((item, idx) => {
      const pos = normalizePosition(item.positionJson || null, idx);
      return { ...pos, i: item.id };
    });
  }, [items]);

  async function fetchChildBlock(item: DashboardItem): Promise<ChildBlock | null> {
    try {
      const detailRes = await fetch(`/api/artifacts/${item.childArtifactId}`);
      const detailPayload = await detailRes.json().catch(() => ({}));
      if (!detailRes.ok) return null;
      const detail = detailPayload as ArtifactDetails;
      const version =
        detail.versions.find((v) => v.id === item.childArtifactVersionId) ||
        detail.latestVersion ||
        detail.versions[0] ||
        null;

      const runRes = await fetch(`/api/artifacts/${item.childArtifactId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: 'api' }),
      });
      const runPayload = await runRes.json().catch(() => ({}));
      const rows = Array.isArray(runPayload?.run?.resultSampleJson)
        ? (runPayload.run.resultSampleJson as Array<Record<string, unknown>>)
        : [];

      return {
        item,
        artifact: detail.artifact,
        version,
        rows,
      };
    } catch {
      return null;
    }
  }

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
      const artifactData = artifactPayload as ArtifactDetails;
      setData(artifactData);
      setRuns(runsPayload?.runs || []);

      if (artifactData.artifact.type === 'dashboard') {
        const [itemsRes, artifactsRes, sourcesRes] = await Promise.all([
          fetch(`/api/artifacts/${artifactId}/items`),
          fetch(`/api/artifacts?projectId=${encodeURIComponent(artifactData.artifact.projectId)}`),
          fetch(`/api/datasources?workstreamId=${encodeURIComponent(artifactData.artifact.projectId)}`),
        ]);
        const itemsPayload = await itemsRes.json().catch(() => ({}));
        const artifactsPayload = await artifactsRes.json().catch(() => ({}));
        const sourcesPayload = await sourcesRes.json().catch(() => ({}));
        const nextItems: DashboardItem[] = itemsPayload?.items || [];
        setItems(nextItems);
        setAllArtifacts((artifactsPayload?.artifacts || []).filter((a: Artifact) => a.type !== 'dashboard'));
        const nextSources: DataSourceOption[] = (sourcesPayload?.dataSources || []).map((ds: any) => ({
          id: String(ds.id),
          name: String(ds.name || ds.id),
          type: String(ds.type || 'source'),
        }));
        setDataSources(nextSources);
        if (!directSourceId && nextSources.length > 0) {
          setDirectSourceId(nextSources[0]!.id);
        }

        setLoadingBlocks(true);
        const resolved = await Promise.all(nextItems.map((item) => fetchChildBlock(item)));
        const nextBlocks: Record<string, ChildBlock> = {};
        for (const block of resolved) {
          if (!block) continue;
          nextBlocks[block.item.id] = block;
        }
        setBlocks(nextBlocks);
        setLoadingBlocks(false);
      } else {
        setItems([]);
        setBlocks({});
        setDataSources([]);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load artifact');
      setData(null);
      setRuns([]);
      setItems([]);
      setBlocks({});
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
      const res = await fetch(`/api/artifacts/${artifactId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: 'manual' }),
      });
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

  async function addBlock() {
    if (!artifactId) return;
    try {
      if (addMode === 'direct') {
        const name = directName.trim() || `New ${directType === 'kpi' ? 'KPI' : directType === 'chart' ? 'Chart' : 'Table'}`;
        const sqlText = directSqlText.trim();
        if (!directSourceId || !sqlText) {
          setError('Source and SQL are required for direct create.');
          return;
        }

        let configJson: Record<string, unknown> = {};
        let metadataJson: Record<string, unknown> = {};
        if (directType === 'chart') {
          configJson = {
            renderer: 'chart',
            chartType: directChartType,
            xField: directChartXField || null,
            yField: directChartYField || null,
          };
          metadataJson = {
            preferredChartType: directChartType,
            xField: directChartXField || null,
            yField: directChartYField || null,
          };
        } else if (directType === 'kpi') {
          configJson = {
            renderer: 'kpi',
            metricField: directMetricField || null,
            aggregation: directMetricAggregation,
          };
          metadataJson = {
            metricField: directMetricField || null,
            aggregation: directMetricAggregation,
          };
        } else if (directType === 'table') {
          const columns = directTableColumns
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
          configJson = {
            renderer: 'table',
            columns: columns.map((key) => ({ key, label: key })),
          };
          metadataJson = {
            columns,
          };
        }

        const res = await fetch(`/api/artifacts/${artifactId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifactType: directType,
            sourceId: directSourceId,
            sqlText,
            name,
            description: directDescription.trim() || null,
            configJson,
            metadataJson,
            displayJson: titleOverride ? { title: titleOverride } : null,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to create block');

        setIsAddOpen(false);
        setTitleOverride('');
        setDirectName('');
        setDirectDescription('');
        setDirectSqlText('');
        await refresh();
        return;
      }

      if (!selectedArtifactId) return;
      const res = await fetch(`/api/artifacts/${artifactId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childArtifactId: selectedArtifactId,
          displayJson: titleOverride ? { title: titleOverride } : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to add block');
      setIsAddOpen(false);
      setSelectedArtifactId('');
      setTitleOverride('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to add block');
    }
  }

  async function removeBlock(itemId: string) {
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to remove block');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to remove block');
    }
  }

  function openEditBlock(itemId: string) {
    const block = blocks[itemId];
    if (!block) {
      setError('Block data is still loading. Try again in a moment.');
      return;
    }
    const config = block.version?.configJson || {};
    const firstRow = block.rows[0] || {};
    const keys = Object.keys(firstRow);
    const numericKeys = keys.filter((k) => typeof firstRow[k] === 'number');
    setEditingItemId(itemId);
    setEditTitle(String(block.item.displayJson?.title || block.artifact.name || ''));
    setEditChartType(String(config.chartType || 'bar'));
    setEditChartXField(String(config.xField || keys[0] || ''));
    setEditChartYField(String(config.yField || numericKeys[0] || keys[0] || ''));
    setEditMetricField(String(config.metricField || numericKeys[0] || keys[0] || ''));
    setEditMetricAggregation(String(config.aggregation || 'count'));
    const tableCols = Array.isArray(config.columns)
      ? config.columns.map((c: any) => String(c.key || c.name || '')).filter(Boolean)
      : Array.isArray(config.tableColumns)
        ? config.tableColumns.map((c: any) => String(c))
        : keys;
    setEditTableColumns(tableCols.join(', '));
    setIsEditOpen(true);
  }

  async function saveBlockConfig() {
    const itemId = editingItemId;
    if (!itemId || !artifactId) return;
    const block = blocks[itemId];
    if (!block || !block.version) return;
    try {
      const type = block.artifact.type;
      let nextConfig: Record<string, unknown> = {};
      if (type === 'chart') {
        nextConfig = {
          ...block.version.configJson,
          renderer: 'chart',
          chartType: editChartType || 'bar',
          xField: editChartXField || null,
          yField: editChartYField || null,
        };
      } else if (type === 'kpi') {
        nextConfig = {
          ...block.version.configJson,
          renderer: 'kpi',
          metricField: editMetricField || null,
          aggregation: editMetricAggregation || 'count',
        };
      } else if (type === 'table') {
        const columns = editTableColumns
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        nextConfig = {
          ...block.version.configJson,
          renderer: 'table',
          columns: columns.map((key) => ({ key, label: key })),
        };
      } else {
        nextConfig = block.version.configJson || {};
      }

      const versionRes = await fetch(`/api/artifacts/${block.artifact.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          querySpecId: block.version.querySpecId || null,
          configJson: nextConfig,
        }),
      });
      const versionPayload = await versionRes.json().catch(() => ({}));
      if (!versionRes.ok) throw new Error(versionPayload?.error || 'Failed to save block config');

      const itemRes = await fetch(`/api/artifacts/${artifactId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childArtifactVersionId: versionPayload?.version?.id || null,
          displayJson: { ...(block.item.displayJson || {}), title: editTitle || block.artifact.name },
        }),
      });
      const itemPayload = await itemRes.json().catch(() => ({}));
      if (!itemRes.ok) throw new Error(itemPayload?.error || 'Failed to update dashboard item');

      setIsEditOpen(false);
      setEditingItemId('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to save block settings');
    }
  }

  async function persistLayout(layout: Layout) {
    if (!artifactId) return;
    setSavingLayout(true);
    try {
      await Promise.all(
        layout.map((l) =>
          fetch(`/api/artifacts/${artifactId}/items/${l.i}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              positionJson: { x: l.x, y: l.y, w: l.w, h: l.h },
            }),
          })
        )
      );
      const byId = new Map(layout.map((l) => [l.i, l]));
      setItems((prev) =>
        prev.map((item) => {
          const updated = byId.get(item.id);
          if (!updated) return item;
          return {
            ...item,
            positionJson: { x: updated.x, y: updated.y, w: updated.w, h: updated.h },
          };
        })
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to save layout');
    } finally {
      setSavingLayout(false);
    }
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading artifact...</div>;
  if (!data) return <div className="p-8 text-sm text-red-600">{error || 'Artifact not found'}</div>;

  const isDashboard = data.artifact.type === 'dashboard';

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
          {isDashboard ? (
            <Button variant="outline" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Block
            </Button>
          ) : null}
          <Button onClick={runNow} disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run
          </Button>
        </div>
      </div>

      {isDashboard ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Dashboard Canvas</CardTitle>
              <div className="text-xs text-muted-foreground">{savingLayout ? 'Saving layout...' : `${items.length} block(s)`}</div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingBlocks ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading blocks...</div>
            ) : items.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No blocks yet. Click "Add Block" to add table/chart/KPI artifacts.
              </div>
            ) : (
              <GridLayout
                className="layout"
                layout={dashboardLayouts}
                gridConfig={{
                  cols: 12,
                  rowHeight: 48,
                  margin: [12, 12],
                  containerPadding: [0, 0],
                  maxRows: Infinity,
                }}
                width={1100}
                dragConfig={{
                  enabled: true,
                  handle: '.artifact-drag-handle',
                }}
                resizeConfig={{
                  enabled: true,
                  handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                }}
                onLayoutChange={(nextLayout: any) => {
                  persistLayout(nextLayout as Layout);
                }}
              >
                {items.map((item) => {
                  const block = blocks[item.id];
                  const title = String(item.displayJson?.title || block?.artifact?.name || 'Block');
                  const type = block?.artifact?.type || 'table';
                  const rows = block?.rows || [];
                  const config = block?.version?.configJson || {};
                  return (
                    <div key={item.id} className="rounded-lg border bg-card shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                        <div className="text-sm font-medium truncate">{title}</div>
                        <div className="flex items-center gap-1">
                          <div className="artifact-drag-handle text-slate-400 hover:text-slate-700 cursor-move px-1" title="Drag block">
                            <GripVertical className="h-3.5 w-3.5" />
                          </div>
                          <Badge variant="outline" className="text-[10px]">{type}</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={!block}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditBlock(item.id);
                            }}
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBlock(item.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="h-[calc(100%-42px)] p-2">
                        {!block ? (
                          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading block...</div>
                        ) : type === 'kpi' ? (
                          <div className="h-full flex flex-col items-center justify-center">
                            <div className="text-3xl font-semibold">{metricValue(config, rows)}</div>
                            <div className="text-xs text-muted-foreground mt-1">{String(config?.metricField || config?.aggregation || 'metric')}</div>
                          </div>
                        ) : type === 'table' ? (
                          <div className="h-full overflow-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  {(Array.isArray(config?.columns) && config.columns.length ? config.columns.map((c: any) => String(c.key || c.name || '')) : Object.keys(rows[0] || {})).slice(0, 8).map((col) => (
                                    <th key={col} className="px-2 py-1 text-left font-medium">{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.slice(0, 8).map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0">
                                    {(Array.isArray(config?.columns) && config.columns.length ? config.columns.map((c: any) => String(c.key || c.name || '')) : Object.keys(row || {})).slice(0, 8).map((col) => (
                                      <td key={`${idx}-${col}`} className="px-2 py-1">{String((row as any)[col] ?? '')}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="h-full">
                            {rows.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                {(() => {
                                  const chart = pickChartConfig(config, rows);
                                  if (chart.chartType === 'line') {
                                    return (
                                      <LineChart data={rows as any[]}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey={chart.xField} hide />
                                        <YAxis hide />
                                        <Tooltip />
                                        <Legend />
                                        {chart.yFields.map((y, idx) => (
                                          <Line key={y.field} type="monotone" dataKey={y.field} stroke={y.color || CHART_COLORS[idx % CHART_COLORS.length]} dot={false} />
                                        ))}
                                      </LineChart>
                                    );
                                  }
                                  if (chart.chartType === 'area') {
                                    return (
                                      <AreaChart data={rows as any[]}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey={chart.xField} hide />
                                        <YAxis hide />
                                        <Tooltip />
                                        {chart.yFields.map((y, idx) => (
                                          <Area key={y.field} type="monotone" dataKey={y.field} stroke={y.color || CHART_COLORS[idx % CHART_COLORS.length]} fill={y.color || CHART_COLORS[idx % CHART_COLORS.length]} fillOpacity={0.25} />
                                        ))}
                                      </AreaChart>
                                    );
                                  }
                                  if (chart.chartType === 'pie') {
                                    const y = chart.yFields[0]?.field || Object.keys(rows[0] || {}).find((k) => typeof (rows[0] as any)[k] === 'number') || '';
                                    const pieData = rows.slice(0, 8).map((r, idx) => ({
                                      name: String((r as any)[chart.xField] ?? `Item ${idx + 1}`),
                                      value: Number((r as any)[y] || 0),
                                    }));
                                    return (
                                      <PieChart>
                                        <Tooltip />
                                        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70}>
                                          {pieData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                                        </Pie>
                                      </PieChart>
                                    );
                                  }
                                  return (
                                    <BarChart data={rows as any[]}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey={chart.xField} hide />
                                      <YAxis hide />
                                      <Tooltip />
                                      {chart.yFields.map((y, idx) => (
                                        <Bar key={y.field} dataKey={y.field} fill={y.color || CHART_COLORS[idx % CHART_COLORS.length]} />
                                      ))}
                                    </BarChart>
                                  );
                                })()}
                              </ResponsiveContainer>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </GridLayout>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!isDashboard ? (
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
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Block To Dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" variant={addMode === 'existing' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('existing')}>
                Existing Artifact
              </Button>
              <Button type="button" variant={addMode === 'direct' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('direct')}>
                Direct Create
              </Button>
            </div>
            {addMode === 'existing' ? (
              <div className="space-y-1">
                <Label>Artifact</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedArtifactId}
                  onChange={(e) => setSelectedArtifactId(e.target.value)}
                >
                  <option value="">Select artifact</option>
                  {allArtifacts
                    .filter((a) => ['table', 'chart', 'kpi'].includes(a.type))
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                    ))}
                </select>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={directType} onChange={(e) => setDirectType(e.target.value as 'table' | 'chart' | 'kpi')}>
                    <option value="chart">Chart</option>
                    <option value="table">Table</option>
                    <option value="kpi">KPI</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={directName} onChange={(e) => setDirectName(e.target.value)} placeholder="e.g., Revenue By Month" />
                </div>
                <div className="space-y-1">
                  <Label>Source</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={directSourceId} onChange={(e) => setDirectSourceId(e.target.value)}>
                    <option value="">Select source</option>
                    {dataSources.map((ds) => (
                      <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>SQL</Label>
                  <textarea
                    className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={directSqlText}
                    onChange={(e) => setDirectSqlText(e.target.value)}
                    placeholder="SELECT * FROM your_table LIMIT 100"
                  />
                </div>
                {directType === 'chart' ? (
                  <>
                    <div className="space-y-1">
                      <Label>Chart Type</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={directChartType} onChange={(e) => setDirectChartType(e.target.value as 'bar' | 'line' | 'area' | 'pie')}>
                        <option value="bar">Bar</option>
                        <option value="line">Line</option>
                        <option value="area">Area</option>
                        <option value="pie">Pie</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>X Field</Label>
                        <Input value={directChartXField} onChange={(e) => setDirectChartXField(e.target.value)} placeholder="month" />
                      </div>
                      <div className="space-y-1">
                        <Label>Y Field</Label>
                        <Input value={directChartYField} onChange={(e) => setDirectChartYField(e.target.value)} placeholder="revenue" />
                      </div>
                    </div>
                  </>
                ) : null}
                {directType === 'kpi' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Metric Field</Label>
                      <Input value={directMetricField} onChange={(e) => setDirectMetricField(e.target.value)} placeholder="amount" />
                    </div>
                    <div className="space-y-1">
                      <Label>Aggregation</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={directMetricAggregation} onChange={(e) => setDirectMetricAggregation(e.target.value as 'count' | 'sum' | 'avg' | 'min' | 'max')}>
                        <option value="count">Count</option>
                        <option value="sum">Sum</option>
                        <option value="avg">Average</option>
                        <option value="min">Min</option>
                        <option value="max">Max</option>
                      </select>
                    </div>
                  </div>
                ) : null}
                {directType === 'table' ? (
                  <div className="space-y-1">
                    <Label>Columns (comma separated, optional)</Label>
                    <Input value={directTableColumns} onChange={(e) => setDirectTableColumns(e.target.value)} placeholder="id, name, created_at" />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label>Description (optional)</Label>
                  <Input value={directDescription} onChange={(e) => setDirectDescription(e.target.value)} placeholder="Optional description" />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Title Override (optional)</Label>
              <Input value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)} placeholder="Custom block title" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button
                onClick={addBlock}
                disabled={addMode === 'existing' ? !selectedArtifactId : !directSourceId || !directSqlText.trim()}
              >
                Add Block
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Block Settings</DialogTitle>
          </DialogHeader>
          {editingItemId && blocks[editingItemId] ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              {blocks[editingItemId].artifact.type === 'chart' ? (
                <>
                  <div className="space-y-1">
                    <Label>Chart Type</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editChartType} onChange={(e) => setEditChartType(e.target.value)}>
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="area">Area</option>
                      <option value="pie">Pie</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>X Field</Label>
                    <Input value={editChartXField} onChange={(e) => setEditChartXField(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Y Field</Label>
                    <Input value={editChartYField} onChange={(e) => setEditChartYField(e.target.value)} />
                  </div>
                </>
              ) : null}
              {blocks[editingItemId].artifact.type === 'kpi' ? (
                <>
                  <div className="space-y-1">
                    <Label>Metric Field</Label>
                    <Input value={editMetricField} onChange={(e) => setEditMetricField(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Aggregation</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editMetricAggregation} onChange={(e) => setEditMetricAggregation(e.target.value)}>
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </div>
                </>
              ) : null}
              {blocks[editingItemId].artifact.type === 'table' ? (
                <div className="space-y-1">
                  <Label>Columns (comma separated)</Label>
                  <Input value={editTableColumns} onChange={(e) => setEditTableColumns(e.target.value)} />
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button onClick={saveBlockConfig}>Save</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
