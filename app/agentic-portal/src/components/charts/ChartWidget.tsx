/**
 * ChartWidget Component
 *
 * Displays chart visualizations using Recharts.
 * Supports bar, line, area, pie, and scatter chart types.
 */
'use client';

import React, { useMemo } from 'react';
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
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Widget, WidgetConfig, YFieldConfig } from '@/types';

// Chart color palette
const CHART_COLORS = [
  '#0066cc', // Blue - primary
  '#e63946', // Red
  '#2a9d8f', // Teal
  '#f4a261', // Orange
  '#9b5de5', // Purple
  '#00b4d8', // Cyan
  '#06d6a0', // Green
  '#ff6b6b', // Coral
];

export interface ChartDataPoint {
  x: string | number;
  y?: number;
  group?: string;
  [key: string]: string | number | undefined;
}

export interface ChartWidgetProps {
  widget: Widget;
  data: ChartDataPoint[];
  isLoading?: boolean;
}

/**
 * Custom Tooltip Component
 */
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
        <p className="font-semibold text-gray-800 mb-2 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            style={{ color: entry.color || entry.stroke || entry.fill }}
            className="text-sm"
          >
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Custom X-Axis Tick Component - truncates long labels
 */
const CustomXAxisTick = ({ x, y, payload }: any) => {
  const maxLength = 15;
  const text = String(payload.value);
  const displayText = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        fill="#6b7280"
        fontSize={12}
        transform="rotate(-45)"
      >
        <title>{text}</title>
        {displayText}
      </text>
    </g>
  );
};

/**
 * Custom Legend Component
 */
const CustomLegend = ({ payload }: any) => {
  const maxLength = 25;

  if (!payload || payload.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 w-full overflow-hidden">
      {payload.map((entry: any, index: number) => {
        const text = String(entry.value || '');
        const displayText = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

        return (
          <div
            key={`legend-${index}`}
            className="flex items-center gap-1.5 text-xs text-gray-600 max-w-[200px]"
            title={text}
          >
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="truncate">{displayText}</span>
          </div>
        );
      })}
    </div>
  );
};

export default function ChartWidget({ widget, data, isLoading = false }: ChartWidgetProps) {
  const { config, type } = widget;

  // Process chart data
  const { chartData, groups, metricKeys } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], groups: [], metricKeys: [] };
    }

    // Get unique groups if colorField is used
    const uniqueGroups = Array.from(
      new Set(data.map((d) => d.group).filter(Boolean))
    ) as string[];

    // Get Y field names
    const yFields = config?.yFields?.map((f: YFieldConfig) => f.field) || ['y'];

    if (uniqueGroups.length > 0) {
      // Pivot data by x value and group
      const pivoted = new Map<string | number, Record<string, number | string>>();
      for (const d of data) {
        const key = d.x;
        if (!pivoted.has(key)) {
          pivoted.set(key, { x: key as any });
        }
        const row = pivoted.get(key)!;
        if (d.group) {
          row[d.group] = d.y ?? 0;
        }
      }

      return {
        chartData: Array.from(pivoted.values()),
        groups: uniqueGroups,
        metricKeys: [],
      };
    } else if (yFields.length > 1) {
      // Multi-Y metrics
      const processed = data.map((d) => {
        const row: Record<string, any> = { x: d.x };
        yFields.forEach((field: string) => {
          row[field] = typeof d[field] === 'number' ? d[field] : d.y;
        });
        return row;
      });

      return {
        chartData: processed,
        groups: [],
        metricKeys: yFields,
      };
    } else {
      // Single Y metric
      const primaryField = yFields[0] || 'y';
      return {
        chartData: data.map((d) => ({
          x: d.x,
          [primaryField]: typeof d[primaryField] === 'number' ? d[primaryField] : d.y,
        })),
        groups: [],
        metricKeys: [primaryField],
      };
    }
  }, [data, config?.yFields]);

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      );
    }

    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          No data available
        </div>
      );
    }

    const hasGroups = groups.length > 0;
    const hasMultipleMetrics = metricKeys.length > 1;
    const showLegend = config?.showLegend !== false && (hasGroups || hasMultipleMetrics);

    const commonMargin = { top: 20, right: 30, left: 20, bottom: 60 };

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={commonMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="x" tick={<CustomXAxisTick />} height={80} interval={0} />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => value.toLocaleString()}
                width={80}
              />
              <Tooltip content={<CustomChartTooltip />} />
              {showLegend && <Legend content={<CustomLegend />} />}
              {hasGroups
                ? groups.map((group, i) => (
                    <Bar
                      key={group}
                      dataKey={group}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      radius={[2, 2, 0, 0]}
                    />
                  ))
                : metricKeys.map((field, i) => (
                    <Bar
                      key={field}
                      dataKey={field}
                      fill={config?.colors?.[i] || CHART_COLORS[i % CHART_COLORS.length]}
                      radius={[2, 2, 0, 0]}
                    />
                  ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={commonMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="x" tick={<CustomXAxisTick />} height={80} interval={0} />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => value.toLocaleString()}
                width={80}
              />
              <Tooltip content={<CustomChartTooltip />} />
              {showLegend && <Legend content={<CustomLegend />} />}
              {hasGroups
                ? groups.map((group, i) => (
                    <Line
                      key={group}
                      type="monotone"
                      dataKey={group}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))
                : metricKeys.map((field, i) => (
                    <Line
                      key={field}
                      type="monotone"
                      dataKey={field}
                      stroke={config?.colors?.[i] || CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{
                        fill: config?.colors?.[i] || CHART_COLORS[i % CHART_COLORS.length],
                        strokeWidth: 2,
                        r: 3,
                      }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={commonMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="x" tick={<CustomXAxisTick />} height={80} interval={0} />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => value.toLocaleString()}
                width={80}
              />
              <Tooltip content={<CustomChartTooltip />} />
              {showLegend && <Legend content={<CustomLegend />} />}
              {hasGroups
                ? groups.map((group, i) => (
                    <Area
                      key={group}
                      type="monotone"
                      dataKey={group}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.3}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))
                : metricKeys.map((field, i) => (
                    <Area
                      key={field}
                      type="monotone"
                      dataKey={field}
                      stroke={config?.colors?.[i] || CHART_COLORS[i % CHART_COLORS.length]}
                      fill={config?.colors?.[i] || CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.3}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        const primaryMetricKey = metricKeys[0] || 'y';
        const pieData = chartData.map((d: any, i) => ({
          name: String(d.x),
          value: Math.abs(d[primaryMetricKey] ?? d.y ?? 0),
          originalValue: d[primaryMetricKey] ?? d.y ?? 0,
        }));

        const validPieData = pieData.filter(
          (item) => typeof item.value === 'number' && !isNaN(item.value)
        );

        if (validPieData.length === 0) {
          return (
            <div className="flex items-center justify-center h-full text-gray-400">
              No data available for pie chart
            </div>
          );
        }

        const innerRadius = type === 'donut' ? 60 : 0;

        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 40, right: 20, left: 20, bottom: 20 }}>
              <Pie
                data={validPieData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }: any) =>
                  (percent ?? 0) > 0.02 ? `${(name ?? '').substring(0, 15)}: ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                }
                labelLine={{ stroke: '#6b7280', strokeWidth: 1 }}
              >
                {validPieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={config?.colors?.[index] || CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomChartTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={commonMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="category"
                dataKey="x"
                name={config?.xField}
                tick={<CustomXAxisTick />}
                height={80}
                interval={0}
              />
              <YAxis
                type="number"
                dataKey={metricKeys[0] || 'y'}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => value.toLocaleString()}
                width={80}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomChartTooltip />} />
              {hasGroups ? (
                <>
                  <Legend content={<CustomLegend />} />
                  {groups.map((group, i) => {
                    const groupData = data.filter((d) => d.group === group);
                    return (
                      <Scatter
                        key={group}
                        name={group}
                        data={groupData}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    );
                  })}
                </>
              ) : (
                <Scatter name={widget.title} data={chartData} fill={CHART_COLORS[0]} />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            Unknown chart type: {type}
          </div>
        );
    }
  };

  return <div className="h-full w-full">{renderChart()}</div>;
}
