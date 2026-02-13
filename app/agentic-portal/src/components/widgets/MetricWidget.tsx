/**
 * MetricWidget Component
 *
 * Single KPI display with big number, optional comparison (% change),
 * and format options (currency, percent, number).
 */
'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Widget } from '@/types';

export interface MetricWidgetProps {
  widget: Widget;
  data: Record<string, unknown>[];
  isLoading?: boolean;
}

interface MetricValue {
  current: number;
  previous?: number;
  change?: number;
  changePercent?: number;
}

export default function MetricWidget({ widget, data, isLoading = false }: MetricWidgetProps) {
  const { config, title } = widget;

  // Calculate metric value
  const metric = useMemo((): MetricValue | null => {
    if (!data || data.length === 0) return null;

    const valueField = config?.valueField || Object.keys(data[0])[0];
    const aggregation = config?.aggregation || 'sum';

    // Aggregate the value
    let current = 0;
    const values = data
      .map((row) => row[valueField])
      .filter((v) => typeof v === 'number') as number[];

    if (values.length === 0) return null;

    switch (aggregation) {
      case 'sum':
        current = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        current = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'count':
        current = values.length;
        break;
      case 'min':
        current = Math.min(...values);
        break;
      case 'max':
        current = Math.max(...values);
        break;
      default:
        current = values.reduce((a, b) => a + b, 0);
    }

    // Get comparison value if comparisonField is specified
    const result: MetricValue = { current };

    if (config?.comparisonField) {
      const compValues = data
        .map((row) => row[config.comparisonField!])
        .filter((v) => typeof v === 'number') as number[];

      if (compValues.length > 0) {
        let previous = 0;
        switch (aggregation) {
          case 'sum':
            previous = compValues.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            previous = compValues.reduce((a, b) => a + b, 0) / compValues.length;
            break;
          case 'count':
            previous = compValues.length;
            break;
          case 'min':
            previous = Math.min(...compValues);
            break;
          case 'max':
            previous = Math.max(...compValues);
            break;
          default:
            previous = compValues.reduce((a, b) => a + b, 0);
        }

        result.previous = previous;
        result.change = current - previous;
        result.changePercent = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
      }
    }

    return result;
  }, [data, config]);

  // Format value based on config
  const formatValue = (value: number): string => {
    const format = config?.format || 'number';

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      case 'percent':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value / 100);
      case 'number':
      default:
        // Use compact notation for large numbers
        if (Math.abs(value) >= 1000000) {
          return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: 1,
          }).format(value);
        }
        return new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 2,
        }).format(value);
    }
  };

  // Format change percent
  const formatChangePercent = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-gray-200 rounded w-32" />
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>
      </div>
    );
  }

  if (!metric) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No data available
      </div>
    );
  }

  const isPositive = metric.changePercent !== undefined && metric.changePercent > 0;
  const isNegative = metric.changePercent !== undefined && metric.changePercent < 0;
  const isNeutral = metric.changePercent !== undefined && metric.changePercent === 0;

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      {/* Main Value */}
      <div className="text-4xl md:text-5xl font-bold text-gray-900 tabular-nums">
        {formatValue(metric.current)}
      </div>

      {/* Label */}
      {title && (
        <div className="mt-2 text-sm text-gray-500 uppercase tracking-wide">{title}</div>
      )}

      {/* Comparison */}
      {metric.changePercent !== undefined && (
        <div
          className={cn(
            'mt-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
            {
              'bg-green-100 text-green-700': isPositive,
              'bg-red-100 text-red-700': isNegative,
              'bg-gray-100 text-gray-600': isNeutral,
            }
          )}
        >
          {isPositive && <TrendingUp className="w-4 h-4" />}
          {isNegative && <TrendingDown className="w-4 h-4" />}
          {isNeutral && <Minus className="w-4 h-4" />}
          <span>{formatChangePercent(metric.changePercent)}</span>
          {metric.previous !== undefined && (
            <span className="text-xs opacity-75">vs {formatValue(metric.previous)}</span>
          )}
        </div>
      )}

      {/* Aggregation type indicator */}
      {config?.aggregation && config.aggregation !== 'sum' && (
        <div className="mt-2 text-xs text-gray-400 uppercase">
          {config.aggregation}
        </div>
      )}
    </div>
  );
}
