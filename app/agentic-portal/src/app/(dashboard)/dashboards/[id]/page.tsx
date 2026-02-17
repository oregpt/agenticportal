'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Settings,
  Share,
  ArrowLeft,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  Hash,
  Table2,
  Move,
  Loader2,
  Trash2,
  Database,
  Edit2,
} from 'lucide-react';
import Link from 'next/link';
import GridLayout, { type Layout } from 'react-grid-layout';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#0066cc', '#e63946', '#2a9d8f', '#f4a261', '#9b5de5'];

// Dashboard widget type for this page
interface DashboardWidget {
  id: string;
  dashboardId: string;
  viewId?: string;
  type: 'metric' | 'chart' | 'table';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: {
    chartType?: 'bar' | 'line' | 'area' | 'pie';
    xField?: string;
    yFields?: { field: string; label: string; color?: string }[];
    metricField?: string;
    metricAggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
    tableColumns?: string[];
  };
}

interface DashboardData {
  id: string;
  name: string;
  description: string | null;
  workstreamId?: string | null;
  widgets: DashboardWidget[];
}

interface ViewOption {
  id: string;
  name: string;
  columns?: { name: string; type?: string }[];
}

const WIDGET_TYPES = [
  { id: 'metric', name: 'Metric Card', icon: Hash, description: 'Display a single KPI value' },
  { id: 'table', name: 'Data Table', icon: Table2, description: 'Show data in rows and columns' },
  { id: 'bar', name: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { id: 'line', name: 'Line Chart', icon: LineChartIcon, description: 'Show trends over time' },
  { id: 'area', name: 'Area Chart', icon: TrendingUp, description: 'Visualize cumulative values' },
  { id: 'pie', name: 'Pie Chart', icon: PieChartIcon, description: 'Show proportions of a whole' },
];

function inferWidgetFields(
  widget: DashboardWidget,
  rows: Array<Record<string, unknown>>
): {
  xField: string;
  yFields: { field: string; label: string; color?: string }[];
} {
  const firstRow = rows[0] || {};
  const keys = Object.keys(firstRow);
  const numericKeys = keys.filter((k) => typeof firstRow[k] === 'number');
  const xField = widget.config.xField || keys[0] || 'label';
  const yFields =
    widget.config.yFields && widget.config.yFields.length > 0
      ? widget.config.yFields
      : (numericKeys.slice(0, 3).map((k, i) => ({
          field: k,
          label: k,
          color: CHART_COLORS[i % CHART_COLORS.length],
        })) as { field: string; label: string; color?: string }[]);

  return { xField, yFields };
}

function isLikelyNumericType(type?: string): boolean {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return (
    normalized.includes('int') ||
    normalized.includes('float') ||
    normalized.includes('double') ||
    normalized.includes('decimal') ||
    normalized.includes('numeric') ||
    normalized.includes('number') ||
    normalized.includes('real')
  );
}

function getNumericColumns(columns: { name: string; type?: string }[]): { name: string; type?: string }[] {
  return columns.filter((column) => isLikelyNumericType(column.type));
}

function computeMetricValue(
  widget: DashboardWidget,
  rows: Array<Record<string, unknown>>
): { value: string | number; description: string } {
  const aggregation = widget.config.metricAggregation || 'count';
  const field = widget.config.metricField;

  if (aggregation === 'count') {
    if (!field) {
      return { value: rows.length, description: 'Row count' };
    }
    const nonNullCount = rows.filter((row) => row[field] !== null && row[field] !== undefined).length;
    return { value: nonNullCount, description: `Count of ${field}` };
  }

  if (!field) {
    return { value: 'N/A', description: 'Choose a numeric field in Edit widget' };
  }

  const numbers = rows
    .map((row) => row[field])
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter((value) => Number.isFinite(value));

  if (numbers.length === 0) {
    return { value: 'N/A', description: `No numeric values found for ${field}` };
  }

  if (aggregation === 'sum') {
    const total = numbers.reduce((sum, value) => sum + value, 0);
    return { value: total.toLocaleString(), description: `Sum of ${field}` };
  }
  if (aggregation === 'avg') {
    const avg = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    return { value: avg.toFixed(2), description: `Average of ${field}` };
  }
  if (aggregation === 'min') {
    return { value: Math.min(...numbers), description: `Minimum ${field}` };
  }
  return { value: Math.max(...numbers), description: `Maximum ${field}` };
}

function buildChartData(
  rows: Array<Record<string, unknown>>,
  xField: string,
  yFields: { field: string; label: string; color?: string }[]
): {
  data: Array<Record<string, number | string>>;
  yFields: { field: string; label: string; color?: string }[];
} {
  // If numeric fields are available, use raw rows.
  if (yFields.length > 0) {
    return {
      data: rows as Array<Record<string, number | string>>,
      yFields,
    };
  }

  // Otherwise, generate a count series grouped by xField.
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = row[xField];
    const label = raw == null ? 'Unknown' : String(raw);
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  return {
    data: Array.from(counts.entries()).map(([label, count]) => ({
      [xField]: label,
      count,
    })),
    yFields: [{ field: 'count', label: 'Count', color: CHART_COLORS[0] }],
  };
}

function formatCellValue(value: unknown): string | number {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function DashboardDetailPage() {
  const params = useParams();
  const dashboardId = params.id as string;
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Add Widget Dialog
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [newWidgetType, setNewWidgetType] = useState('bar');
  const [newWidgetViewId, setNewWidgetViewId] = useState('');
  const [newChartXField, setNewChartXField] = useState('');
  const [newChartYField, setNewChartYField] = useState('');
  const [newMetricAggregation, setNewMetricAggregation] = useState<'count' | 'sum' | 'avg' | 'min' | 'max'>('count');
  const [newMetricField, setNewMetricField] = useState('');
  const [newTableColumns, setNewTableColumns] = useState<string[]>([]);
  const [isAddingWidget, setIsAddingWidget] = useState(false);
  const [widgetRows, setWidgetRows] = useState<Record<string, Array<Record<string, unknown>>>>({});
  const [views, setViews] = useState<ViewOption[]>([]);
  const [availableSourceViews, setAvailableSourceViews] = useState<ViewOption[]>([]);
  const [showEditWidget, setShowEditWidget] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [editWidgetTitle, setEditWidgetTitle] = useState('');
  const [editWidgetType, setEditWidgetType] = useState('bar');
  const [editWidgetViewId, setEditWidgetViewId] = useState('');
  const [editChartXField, setEditChartXField] = useState('');
  const [editChartYField, setEditChartYField] = useState('');
  const [editMetricAggregation, setEditMetricAggregation] = useState<'count' | 'sum' | 'avg' | 'min' | 'max'>('count');
  const [editMetricField, setEditMetricField] = useState('');
  const [editTableColumns, setEditTableColumns] = useState<string[]>([]);
  const [isSavingWidgetEdit, setIsSavingWidgetEdit] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(1100);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch(`/api/dashboards/${dashboardId}`);
        if (!response.ok) {
          setDashboard({
            id: dashboardId,
            name: 'Untitled Dashboard',
            description: 'Loaded in local mode because the dashboard record could not be fetched.',
            widgets: [],
          });
          return;
        }

        const data = await response.json();
        const widgets: DashboardWidget[] = (data.widgets || []).map(
          (widget: {
            id: string;
            dashboardId: string;
            viewId: string;
            type: string;
            title: string | null;
            position?: { x?: number; y?: number; width?: number; height?: number };
            config?: {
              chartType?: 'bar' | 'line' | 'area' | 'pie';
              xField?: string;
              yFields?: { field: string; label: string; color?: string }[];
            };
          }) => {
            const widgetType =
              widget.type === 'metric' || widget.type === 'table' ? widget.type : 'chart';
            return {
              id: widget.id,
              dashboardId: widget.dashboardId,
              viewId: widget.viewId,
              type: widgetType,
              title: widget.title || 'Untitled Widget',
              position: {
                x: widget.position?.x ?? 0,
                y: widget.position?.y ?? 0,
                width: widget.position?.width ?? 1,
                height: widget.position?.height ?? 2,
              },
              config: widget.config || {},
            };
          }
        );

        setDashboard({
          id: data.dashboard.id,
          name: data.dashboard.name,
          description: data.dashboard.description || null,
          workstreamId: data.dashboard.workstreamId || null,
          widgets,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
        setDashboard({
          id: dashboardId,
          name: 'Untitled Dashboard',
          description: 'Loaded in local mode because dashboard fetch failed.',
          workstreamId: null,
          widgets: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [dashboardId]);

  useEffect(() => {
    async function fetchViews() {
      try {
        let url = '/api/views';
        if (dashboard?.workstreamId) {
          url += `?workstreamId=${encodeURIComponent(dashboard.workstreamId)}`;
        }
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const options = (data.views || []).map(
          (v: { id: string; name: string; columns?: { name: string; type?: string }[] }) => ({
            id: v.id,
            name: v.name,
            columns: v.columns || [],
          })
        );
        setViews(options);
        setAvailableSourceViews(options);
        if (options.length > 0) {
          setNewWidgetViewId(options[0].id);
        }
      } catch {
        // best effort
      }
    }
    fetchViews();
  }, [dashboard?.workstreamId]);

  useEffect(() => {
    const updateWidth = () => {
      if (!gridRef.current) return;
      const next = Math.max(800, gridRef.current.clientWidth);
      setGridWidth(next);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    async function loadWidgetRows() {
      if (!dashboard || dashboard.widgets.length === 0) return;

      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) return;
        const me = await meRes.json();
        const orgId = me?.user?.organizationId as string | undefined;
        if (!orgId) return;

        const entries = await Promise.all(
          dashboard.widgets.map(async (widget) => {
            if (!widget.viewId) return [widget.id, []] as const;

            try {
              const viewRes = await fetch(`/api/views/${widget.viewId}`);
              if (!viewRes.ok) return [widget.id, []] as const;
              const viewData = await viewRes.json();
              const view = viewData.view as { dataSourceId: string; sql: string } | undefined;
              if (!view?.dataSourceId || !view?.sql) return [widget.id, []] as const;

              const queryRes = await fetch(
                `/api/datasources/${view.dataSourceId}/query?organizationId=${encodeURIComponent(orgId)}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sql: view.sql, limit: 100 }),
                }
              );

              if (!queryRes.ok) return [widget.id, []] as const;
              const queryData = await queryRes.json();
              const rows = (queryData?.result?.rows || []) as Array<Record<string, unknown>>;
              return [widget.id, rows] as const;
            } catch {
              return [widget.id, []] as const;
            }
          })
        );

        setWidgetRows(Object.fromEntries(entries));
      } catch (error) {
        console.error('Failed to load widget data rows:', error);
      }
    }

    loadWidgetRows();
  }, [dashboard]);

  const selectedNewView = useMemo(
    () => views.find((view) => view.id === newWidgetViewId) || null,
    [views, newWidgetViewId]
  );
  const selectedNewViewColumns = useMemo(
    () => selectedNewView?.columns || [],
    [selectedNewView]
  );
  const selectedNewNumericColumns = useMemo(
    () => getNumericColumns(selectedNewViewColumns),
    [selectedNewViewColumns]
  );

  const selectedEditView = useMemo(
    () => views.find((view) => view.id === editWidgetViewId) || null,
    [views, editWidgetViewId]
  );
  const selectedEditViewColumns = useMemo(
    () => selectedEditView?.columns || [],
    [selectedEditView]
  );
  const selectedEditNumericColumns = useMemo(
    () => getNumericColumns(selectedEditViewColumns),
    [selectedEditViewColumns]
  );

  useEffect(() => {
    if (!selectedNewView) return;
    if (!newChartXField && selectedNewViewColumns.length > 0) {
      setNewChartXField(selectedNewViewColumns[0].name);
    }
    if (!newChartYField && selectedNewNumericColumns.length > 0) {
      setNewChartYField(selectedNewNumericColumns[0].name);
    }
    if (!newMetricField && selectedNewNumericColumns.length > 0) {
      setNewMetricField(selectedNewNumericColumns[0].name);
    }
    if (newWidgetType === 'table') {
      const available = selectedNewViewColumns.map((column) => column.name);
      if (newTableColumns.length === 0) {
        setNewTableColumns(available);
      } else {
        setNewTableColumns((prev) => prev.filter((name) => available.includes(name)));
      }
    }
  }, [
    selectedNewView,
    selectedNewViewColumns,
    selectedNewNumericColumns,
    newChartXField,
    newChartYField,
    newMetricField,
    newWidgetType,
    newTableColumns.length,
  ]);

  useEffect(() => {
    if (!showEditWidget) return;
    if ((editWidgetType === 'bar' || editWidgetType === 'line' || editWidgetType === 'area' || editWidgetType === 'pie') && !editChartXField && selectedEditViewColumns.length > 0) {
      setEditChartXField(selectedEditViewColumns[0].name);
    }
    if ((editWidgetType === 'bar' || editWidgetType === 'line' || editWidgetType === 'area' || editWidgetType === 'pie') && !editChartYField && selectedEditNumericColumns.length > 0) {
      setEditChartYField(selectedEditNumericColumns[0].name);
    }
    if (editWidgetType === 'metric' && !editMetricField && selectedEditNumericColumns.length > 0) {
      setEditMetricField(selectedEditNumericColumns[0].name);
    }
    if (editWidgetType === 'table') {
      const available = selectedEditViewColumns.map((column) => column.name);
      if (editTableColumns.length === 0) {
        setEditTableColumns(available);
      } else {
        setEditTableColumns((prev) => prev.filter((name) => available.includes(name)));
      }
    }
  }, [
    showEditWidget,
    editWidgetType,
    editChartXField,
    editChartYField,
    editMetricField,
    selectedEditViewColumns,
    selectedEditNumericColumns,
    editTableColumns.length,
  ]);

  const gridLayout = useMemo<Layout>(
    () =>
      (dashboard?.widgets || []).map((w) => ({
        i: w.id,
        x: w.position.x,
        y: w.position.y,
        w: Math.max(1, w.position.width),
        h: Math.max(2, w.position.height),
        minW: 1,
        minH: 2,
      })),
    [dashboard]
  );

  const persistLayout = (nextWidgets: DashboardWidget[]) => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(async () => {
      try {
        setIsSavingLayout(true);
        await Promise.all(
          nextWidgets.map((w) =>
            fetch(`/api/widgets/${w.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                position: {
                  x: w.position.x,
                  y: w.position.y,
                  width: w.position.width,
                  height: w.position.height,
                },
              }),
            })
          )
        );
      } catch (error) {
        console.error('Failed to persist layout:', error);
      } finally {
        setIsSavingLayout(false);
      }
    }, 500);
  };

  const handleGridLayoutChange = (layout: Layout) => {
    if (!dashboard) return;
    const byId = new Map(layout.map((l) => [l.i, l]));
    const nextWidgets = dashboard.widgets.map((widget) => {
      const cell = byId.get(widget.id);
      if (!cell) return widget;
      return {
        ...widget,
        position: {
          x: cell.x,
          y: cell.y,
          width: cell.w,
          height: cell.h,
        },
      };
    });
    setDashboard({ ...dashboard, widgets: nextWidgets });
    persistLayout(nextWidgets);
  };

  const handleAddWidget = async () => {
    if (!newWidgetTitle.trim()) return;
    
    setIsAddingWidget(true);
    
    const widgetType = newWidgetType === 'metric' ? 'metric' : newWidgetType === 'table' ? 'table' : 'chart';
    const widgetWidth = newWidgetType === 'metric' ? 1 : newWidgetType === 'table' ? 3 : 2;

    try {
      const targetViewId =
        newWidgetViewId || dashboard?.widgets.find((w) => w.viewId)?.viewId || views[0]?.id || '';
      if (!targetViewId) {
        alert('No available view to attach this widget.');
        return;
      }

      if (widgetType === 'chart') {
        if (!newChartXField || !newChartYField) {
          alert('Choose both X and Y fields for chart widgets.');
          return;
        }
      }

      if (widgetType === 'metric') {
        if (newMetricAggregation !== 'count' && !newMetricField) {
          alert('Choose a numeric field for this metric.');
          return;
        }
      }

      const config: DashboardWidget['config'] =
        widgetType === 'chart'
          ? {
              chartType: newWidgetType as 'bar' | 'line' | 'area' | 'pie',
              xField: newChartXField,
              yFields: [{ field: newChartYField, label: newChartYField }],
            }
          : widgetType === 'metric'
          ? {
              metricAggregation: newMetricAggregation,
              metricField: newMetricField || undefined,
            }
          : {
              tableColumns:
                newTableColumns.length > 0
                  ? newTableColumns
                  : selectedNewViewColumns.map((column) => column.name),
            };

      const create = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardId,
          viewId: targetViewId,
          type: widgetType,
          title: newWidgetTitle,
          position: { x: 0, y: 9999, width: widgetWidth, height: 2 },
          config,
        }),
      });
      const created = await create.json();
      if (!create.ok) {
        throw new Error(created.error || 'Failed to create widget');
      }

      const widget = created.widget as {
        id: string;
        dashboardId: string;
        viewId: string;
        type: string;
        title: string | null;
        position: { x?: number; y?: number; width?: number; height?: number };
        config?: DashboardWidget['config'];
      };

      if (dashboard) {
        const normalizedType = widget.type === 'metric' || widget.type === 'table' ? widget.type : 'chart';
        setDashboard({
          ...dashboard,
          widgets: [
            ...dashboard.widgets,
            {
              id: widget.id,
              dashboardId: widget.dashboardId,
              viewId: widget.viewId,
              type: normalizedType,
              title: widget.title || newWidgetTitle,
              position: {
                x: widget.position?.x ?? 0,
                y: widget.position?.y ?? 0,
                width: widget.position?.width ?? widgetWidth,
                height: widget.position?.height ?? 2,
              },
              config: widget.config || {},
            },
          ],
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create widget';
      alert(message);
    }
    
    setShowAddWidget(false);
    setNewWidgetTitle('');
    setNewWidgetType('bar');
    setNewChartXField('');
    setNewChartYField('');
    setNewMetricAggregation('count');
    setNewMetricField('');
    setNewTableColumns([]);
    setIsAddingWidget(false);
  };

  const handleDeleteWidget = async (widgetId: string) => {
    const confirmed = window.confirm('Delete this widget?');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/widgets/${widgetId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete widget');
      }

      if (dashboard) {
        setDashboard({
          ...dashboard,
          widgets: dashboard.widgets.filter((widget) => widget.id !== widgetId),
        });
      }
      setWidgetRows((prev) => {
        const next = { ...prev };
        delete next[widgetId];
        return next;
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete widget');
    }
  };

  const openEditWidget = (widget: DashboardWidget) => {
    const widgetTypeId =
      widget.type === 'chart' ? widget.config.chartType || 'bar' : widget.type;
    setEditingWidgetId(widget.id);
    setEditWidgetTitle(widget.title);
    setEditWidgetType(widgetTypeId);
    setEditWidgetViewId(widget.viewId || '');
    setEditChartXField(widget.config.xField || '');
    setEditChartYField(widget.config.yFields?.[0]?.field || '');
    setEditMetricAggregation(widget.config.metricAggregation || 'count');
    setEditMetricField(widget.config.metricField || '');
    const viewColumns = views.find((view) => view.id === (widget.viewId || ''))?.columns || [];
    const allColumns = viewColumns.map((column) => column.name);
    setEditTableColumns(
      widget.config.tableColumns && widget.config.tableColumns.length > 0
        ? widget.config.tableColumns
        : allColumns
    );
    setShowEditWidget(true);
  };

  const handleSaveWidgetEdit = async () => {
    if (!dashboard || !editingWidgetId || !editWidgetTitle.trim()) return;

    const widgetType = editWidgetType === 'metric' ? 'metric' : editWidgetType === 'table' ? 'table' : 'chart';

    if (widgetType === 'chart' && (!editChartXField || !editChartYField)) {
      alert('Choose both X and Y fields for chart widgets.');
      return;
    }
    if (widgetType === 'metric' && editMetricAggregation !== 'count' && !editMetricField) {
      alert('Choose a numeric field for this metric.');
      return;
    }
    if (!editWidgetViewId) {
      alert('Choose a source view.');
      return;
    }

    const config: DashboardWidget['config'] =
      widgetType === 'chart'
        ? {
            chartType: editWidgetType as 'bar' | 'line' | 'area' | 'pie',
            xField: editChartXField,
            yFields: [{ field: editChartYField, label: editChartYField }],
          }
        : widgetType === 'metric'
        ? {
            metricAggregation: editMetricAggregation,
            metricField: editMetricField || undefined,
          }
        : {
            tableColumns:
              editTableColumns.length > 0
                ? editTableColumns
                : selectedEditViewColumns.map((column) => column.name),
          };

    setIsSavingWidgetEdit(true);
    try {
      const response = await fetch(`/api/widgets/${editingWidgetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editWidgetTitle.trim(),
          viewId: editWidgetViewId,
          type: widgetType,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update widget');
      }

      setDashboard({
        ...dashboard,
        widgets: dashboard.widgets.map((widget) =>
          widget.id === editingWidgetId
            ? {
                ...widget,
                title: editWidgetTitle.trim(),
                viewId: editWidgetViewId,
                type: widgetType,
                config,
              }
            : widget
        ),
      });

      setShowEditWidget(false);
      setEditingWidgetId(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update widget');
    } finally {
      setIsSavingWidgetEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-zinc-200 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-64 bg-zinc-200 rounded"></div>
            <div className="h-64 bg-zinc-200 rounded col-span-2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Dashboard not found</h2>
          <p className="text-muted-foreground mb-4">This dashboard does not exist or has been deleted.</p>
          <Link href="/dashboards">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboards
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-b from-[#f8fbff] via-[#f7f8fc] to-[#f6faf5] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 bg-white/70 backdrop-blur border border-[#dde7f3] rounded-2xl px-5 py-4 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboards">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 truncate">{dashboard.name}</h1>
            <p className="text-slate-500 truncate">{dashboard.description || 'Interactive dashboard workspace'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 mr-2 flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5" />
            Drag + Resize Enabled
          </div>
          {isSavingLayout ? (
            <div className="text-xs text-slate-500 mr-2 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving layout...
            </div>
          ) : null}
          <Button variant="outline">
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button onClick={() => setShowAddWidget(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Widget
          </Button>
        </div>
      </div>

      {/* Add Widget Dialog */}
      <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
        <DialogContent className="w-[96vw] max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Create a new widget for your dashboard
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Widget Title</Label>
              <Input
                placeholder="e.g., Monthly Revenue"
                value={newWidgetTitle}
                onChange={(e) => setNewWidgetTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Source View</Label>
              <select
                value={newWidgetViewId}
                onChange={(e) => setNewWidgetViewId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {views.length === 0 ? <option value="">No views available</option> : null}
                {views.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Widget Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {WIDGET_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setNewWidgetType(type.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      newWidgetType === type.id ? 'border-orange-500 bg-orange-50' : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <type.icon className={`w-5 h-5 ${newWidgetType === type.id ? 'text-orange-500' : 'text-zinc-500'}`} />
                    <div>
                      <div className="font-medium text-sm">{type.name}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {(newWidgetType === 'bar' || newWidgetType === 'line' || newWidgetType === 'area' || newWidgetType === 'pie') && (
              <>
                <div className="space-y-2">
                  <Label>X Field</Label>
                  <select
                    value={newChartXField}
                    onChange={(e) => setNewChartXField(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select field...</option>
                    {selectedNewViewColumns.map((column) => (
                      <option key={`new-x-${column.name}`} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Y Field</Label>
                  <select
                    value={newChartYField}
                    onChange={(e) => setNewChartYField(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select numeric field...</option>
                    {selectedNewNumericColumns.map((column) => (
                      <option key={`new-y-${column.name}`} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {newWidgetType === 'metric' && (
              <>
                <div className="space-y-2">
                  <Label>Aggregation</Label>
                  <select
                    value={newMetricAggregation}
                    onChange={(e) => setNewMetricAggregation(e.target.value as 'count' | 'sum' | 'avg' | 'min' | 'max')}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="count">Count</option>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Field (optional for Count)</Label>
                  <select
                    value={newMetricField}
                    onChange={(e) => setNewMetricField(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">All rows</option>
                    {selectedNewNumericColumns.map((column) => (
                      <option key={`new-metric-${column.name}`} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {newWidgetType === 'table' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Table Fields</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setNewTableColumns(selectedNewViewColumns.map((column) => column.name))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={() => setNewTableColumns([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Defaults to all fields. Deselect any you do not want shown.</p>
                <div className="max-h-48 overflow-auto rounded-md border border-slate-200 p-2 space-y-1">
                  {selectedNewViewColumns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No columns found for this view.</p>
                  ) : (
                    selectedNewViewColumns.map((column) => (
                      <label key={`new-table-col-${column.name}`} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newTableColumns.includes(column.name)}
                          onChange={(e) => {
                            setNewTableColumns((prev) =>
                              e.target.checked ? [...prev, column.name] : prev.filter((name) => name !== column.name)
                            );
                          }}
                        />
                        <span>{column.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWidget(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddWidget} disabled={!newWidgetTitle.trim() || isAddingWidget || views.length === 0}>
              {isAddingWidget ? 'Adding...' : 'Add Widget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditWidget} onOpenChange={setShowEditWidget}>
        <DialogContent className="w-[96vw] max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Widget</DialogTitle>
            <DialogDescription>Update this widget&apos;s source and display settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Widget Title</Label>
              <Input value={editWidgetTitle} onChange={(e) => setEditWidgetTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Source View</Label>
              <select
                value={editWidgetViewId}
                onChange={(e) => setEditWidgetViewId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {views.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Widget Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {WIDGET_TYPES.map((type) => (
                  <button
                    key={`edit-${type.id}`}
                    onClick={() => setEditWidgetType(type.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      editWidgetType === type.id ? 'border-orange-500 bg-orange-50' : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <type.icon className={`w-5 h-5 ${editWidgetType === type.id ? 'text-orange-500' : 'text-zinc-500'}`} />
                    <div>
                      <div className="font-medium text-sm">{type.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {(editWidgetType === 'bar' || editWidgetType === 'line' || editWidgetType === 'area' || editWidgetType === 'pie') && (
              <>
                <div className="space-y-2">
                  <Label>X Field</Label>
                  <select
                    value={editChartXField}
                    onChange={(e) => setEditChartXField(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select field...</option>
                    {selectedEditViewColumns.map((column) => (
                      <option key={`edit-x-${column.name}`} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Y Field</Label>
                  <select
                    value={editChartYField}
                    onChange={(e) => setEditChartYField(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select numeric field...</option>
                    {selectedEditNumericColumns.map((column) => (
                      <option key={`edit-y-${column.name}`} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {editWidgetType === 'metric' && (
              <>
                <div className="space-y-2">
                  <Label>Aggregation</Label>
                  <select
                    value={editMetricAggregation}
                    onChange={(e) => setEditMetricAggregation(e.target.value as 'count' | 'sum' | 'avg' | 'min' | 'max')}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="count">Count</option>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Field (optional for Count)</Label>
                  <select
                    value={editMetricField}
                    onChange={(e) => setEditMetricField(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">All rows</option>
                    {selectedEditNumericColumns.map((column) => (
                      <option key={`edit-metric-${column.name}`} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {editWidgetType === 'table' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Table Fields</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setEditTableColumns(selectedEditViewColumns.map((column) => column.name))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={() => setEditTableColumns([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Defaults to all fields. Deselect any you do not want shown.</p>
                <div className="max-h-48 overflow-auto rounded-md border border-slate-200 p-2 space-y-1">
                  {selectedEditViewColumns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No columns found for this view.</p>
                  ) : (
                    selectedEditViewColumns.map((column) => (
                      <label key={`edit-table-col-${column.name}`} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editTableColumns.includes(column.name)}
                          onChange={(e) => {
                            setEditTableColumns((prev) =>
                              e.target.checked ? [...prev, column.name] : prev.filter((name) => name !== column.name)
                            );
                          }}
                        />
                        <span>{column.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditWidget(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWidgetEdit} disabled={!editWidgetTitle.trim() || isSavingWidgetEdit}>
              {isSavingWidgetEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Widgets Grid */}
      <div ref={gridRef} className="rounded-2xl border border-[#dce8f5] bg-white/50 p-4">
        <div className="mb-4 rounded-xl border border-[#d9e6f3] bg-white/70 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium text-slate-700">Available Sources</p>
          </div>
          {availableSourceViews.length === 0 ? (
            <p className="text-xs text-slate-500">
              No views available yet. Create one in Views.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableSourceViews.map((view) => (
                <span
                  key={view.id}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                >
                  {view.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <GridLayout
          layout={gridLayout}
          gridConfig={{
            cols: 4,
            rowHeight: 120,
            margin: [16, 16],
            containerPadding: [0, 0],
            maxRows: Infinity,
          }}
          width={gridWidth}
          dragConfig={{
            enabled: true,
            handle: '.widget-drag-handle',
          }}
          resizeConfig={{
            enabled: true,
            handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
          }}
          onLayoutChange={handleGridLayoutChange}
        >
          {dashboard.widgets.map((widget) => {
          const data = (widgetRows[widget.id] || []) as Array<Record<string, number | string>>;
          const chartType = widget.config.chartType;
          const { xField, yFields } = inferWidgetFields(widget, data as Array<Record<string, unknown>>);
          const chartPayload = buildChartData(data as Array<Record<string, unknown>>, xField, yFields);
          const metricDisplay = computeMetricValue(widget, data as Array<Record<string, unknown>>);
          
          return (
            <div key={widget.id}>
              {widget.type === 'metric' ? (
                <Card className="h-full border-[#d9e6f3] shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {widget.title}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <button
                        className="text-slate-400 hover:text-slate-700"
                        onClick={() => openEditWidget(widget)}
                        aria-label="Edit widget"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => handleDeleteWidget(widget.id)}
                        aria-label="Delete widget"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="widget-drag-handle text-slate-400 hover:text-slate-700 cursor-move">
                        <Move className="w-4 h-4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metricDisplay.value}</div>
                    <p className="text-xs text-muted-foreground">{metricDisplay.description}</p>
                  </CardContent>
                </Card>
              ) : widget.type === 'chart' ? (
                <Card className="h-full border-[#d9e6f3] shadow-sm rounded-2xl overflow-hidden flex flex-col">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0 shrink-0">
                    <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                    <div className="flex items-center gap-1">
                      <button
                        className="text-slate-400 hover:text-slate-700"
                        onClick={() => openEditWidget(widget)}
                        aria-label="Edit widget"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => handleDeleteWidget(widget.id)}
                        aria-label="Delete widget"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="widget-drag-handle text-slate-400 hover:text-slate-700 cursor-move">
                        <Move className="w-4 h-4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0">
                    <div className="h-full min-h-0">
                      {chartPayload.data.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                          No query results available for this chart.
                        </div>
                      ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'bar' ? (
                          <BarChart data={chartPayload.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={xField} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {chartPayload.yFields.map((yf, i) => (
                              <Bar key={yf.field} dataKey={yf.field} fill={yf.color || CHART_COLORS[i]} name={yf.label} />
                            ))}
                          </BarChart>
                        ) : chartType === 'line' ? (
                          <LineChart data={chartPayload.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={xField} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {chartPayload.yFields.map((yf, i) => (
                              <Line key={yf.field} type="monotone" dataKey={yf.field} stroke={yf.color || CHART_COLORS[i]} name={yf.label} />
                            ))}
                          </LineChart>
                        ) : chartType === 'area' ? (
                          <AreaChart data={chartPayload.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={xField} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {chartPayload.yFields.map((yf, i) => (
                              <Area key={yf.field} type="monotone" dataKey={yf.field} fill={yf.color || CHART_COLORS[i]} stroke={yf.color || CHART_COLORS[i]} name={yf.label} />
                            ))}
                          </AreaChart>
                        ) : chartType === 'pie' ? (
                          <PieChart>
                            <Pie
                              data={chartPayload.data}
                              dataKey={chartPayload.yFields[0]?.field || 'value'}
                              nameKey={xField}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label
                            >
                              {chartPayload.data.map((_, i: number) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            Unknown chart type
                          </div>
                        )}
                      </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : widget.type === 'table' ? (
                <Card className="h-full border-[#d9e6f3] shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                    <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                    <div className="flex items-center gap-1">
                      <button
                        className="text-slate-400 hover:text-slate-700"
                        onClick={() => openEditWidget(widget)}
                        aria-label="Edit widget"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => handleDeleteWidget(widget.id)}
                        aria-label="Delete widget"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="widget-drag-handle text-slate-400 hover:text-slate-700 cursor-move">
                        <Move className="w-4 h-4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="h-full">
                    <div className="border rounded-lg overflow-auto h-full">
                      {(() => {
                        const selectedColumns =
                          widget.config.tableColumns && widget.config.tableColumns.length > 0
                            ? widget.config.tableColumns
                            : data.length > 0
                            ? Object.keys(data[0])
                            : [];
                        return (
                          <>
                            {data.length === 0 ? (
                              <div className="p-6 text-sm text-muted-foreground">No data available for this widget yet.</div>
                            ) : null}
                            <table className="w-full text-sm">
                              <thead className="bg-zinc-50">
                                <tr>
                                  {selectedColumns.map((key) => (
                                    <th key={key} className="px-4 py-3 text-left font-medium text-zinc-600 border-b">
                                      {key.charAt(0).toUpperCase() + key.slice(1)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {data.map((row, i: number) => (
                                  <tr key={i} className="border-b last:border-0 hover:bg-zinc-50">
                                    {selectedColumns.map((key) => {
                                      const value = row[key];
                                      return (
                                        <td key={`${i}-${key}`} className="px-4 py-3">
                                          {typeof value === 'string' && value.startsWith('+') ? (
                                            <span className="text-green-600 font-medium">{value}</span>
                                          ) : typeof value === 'string' && value.startsWith('-') ? (
                                            <span className="text-red-600 font-medium">{value}</span>
                                          ) : (
                                            formatCellValue(value)
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full border-[#d9e6f3] shadow-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-4">
                    <p className="text-muted-foreground">Unknown widget type</p>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
        </GridLayout>
      </div>
      <style jsx global>{`
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          z-index: 20;
          background: transparent;
          opacity: 0.95;
        }
        .react-grid-item > .react-resizable-handle::after {
          content: '';
          position: absolute;
          background: linear-gradient(135deg, #5b7cfa, #16a34a);
          border-radius: 999px;
          opacity: 0.9;
        }
        .react-grid-item > .react-resizable-handle-se,
        .react-grid-item > .react-resizable-handle-ne,
        .react-grid-item > .react-resizable-handle-sw,
        .react-grid-item > .react-resizable-handle-nw {
          width: 16px;
          height: 16px;
        }
        .react-grid-item > .react-resizable-handle-se::after,
        .react-grid-item > .react-resizable-handle-ne::after,
        .react-grid-item > .react-resizable-handle-sw::after,
        .react-grid-item > .react-resizable-handle-nw::after {
          width: 10px;
          height: 10px;
          top: 3px;
          left: 3px;
        }
        .react-grid-item > .react-resizable-handle-n,
        .react-grid-item > .react-resizable-handle-s {
          left: 14px;
          right: 14px;
          height: 8px;
          cursor: ns-resize;
        }
        .react-grid-item > .react-resizable-handle-n::after,
        .react-grid-item > .react-resizable-handle-s::after {
          left: 0;
          right: 0;
          height: 3px;
          top: 2px;
        }
        .react-grid-item > .react-resizable-handle-e,
        .react-grid-item > .react-resizable-handle-w {
          top: 14px;
          bottom: 14px;
          width: 8px;
          cursor: ew-resize;
        }
        .react-grid-item > .react-resizable-handle-e::after,
        .react-grid-item > .react-resizable-handle-w::after {
          top: 0;
          bottom: 0;
          width: 3px;
          left: 2px;
        }
        .react-grid-item.react-grid-placeholder {
          background: rgba(91, 124, 250, 0.16);
          border: 1px dashed #5b7cfa;
          border-radius: 16px;
        }
      `}</style>
    </div>
  );
}

