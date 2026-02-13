/**
 * TableWidget Component
 *
 * Paginated data table with sortable columns and column visibility toggle.
 * Uses shadcn/ui Table component.
 */
'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  Columns,
} from 'lucide-react';
import type { Widget, ViewColumn } from '@/types';

export interface TableWidgetProps {
  widget: Widget;
  data: Record<string, unknown>[];
  columns?: ViewColumn[];
  isLoading?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

export default function TableWidget({
  widget,
  data,
  columns: providedColumns,
  isLoading = false,
}: TableWidgetProps) {
  const { config } = widget;

  // Derive columns from data if not provided
  const columns = useMemo(() => {
    if (providedColumns && providedColumns.length > 0) {
      return providedColumns;
    }
    if (data.length === 0) return [];
    return Object.keys(data[0]).map((key) => ({
      name: key,
      type: typeof data[0][key] === 'number' ? 'number' : 'string',
      displayName: key,
      visible: true,
    }));
  }, [data, providedColumns]);

  // State
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>({
    column: config?.sortField || null,
    direction: config?.sortDirection || null,
  });
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (config?.visibleColumns) {
      return new Set(config.visibleColumns);
    }
    return new Set(columns.map((c) => c.name));
  });

  const pageSize = config?.pageSize || 10;

  // Filter visible columns
  const displayColumns = useMemo(() => {
    return columns.filter((col) => visibleColumns.has(col.name));
  }, [columns, visibleColumns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sort.column || !sort.direction) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sort.column!];
      const bVal = b[sort.column!];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }, [data, sort]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handlers
  const handleSort = (columnName: string) => {
    setSort((prev) => {
      if (prev.column === columnName) {
        // Cycle: asc -> desc -> null
        if (prev.direction === 'asc') return { column: columnName, direction: 'desc' };
        if (prev.direction === 'desc') return { column: null, direction: null };
      }
      return { column: columnName, direction: 'asc' };
    });
  };

  const toggleColumnVisibility = (columnName: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnName)) {
        // Don't allow hiding all columns
        if (next.size > 1) {
          next.delete(columnName);
        }
      } else {
        next.add(columnName);
      }
      return next;
    });
  };

  const formatValue = (value: unknown, column: ViewColumn): string => {
    if (value === null || value === undefined) return '—';

    const format = column.format || 'default';

    if (typeof value === 'number') {
      switch (format) {
        case 'currency':
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(value);
        case 'percent':
          return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 2,
          }).format(value / 100);
        case 'number':
          return value.toLocaleString();
        default:
          return value.toLocaleString();
      }
    }

    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      const date = value instanceof Date ? value : new Date(value);
      if (format === 'datetime') {
        return date.toLocaleString();
      }
      if (format === 'date') {
        return date.toLocaleDateString();
      }
    }

    return String(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-2 py-1.5 border-b bg-slate-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <Columns className="w-4 h-4 mr-1" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.name}
                checked={visibleColumns.has(column.name)}
                onCheckedChange={() => toggleColumnVisibility(column.name)}
              >
                {column.displayName || column.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {displayColumns.map((column) => (
                <TableHead
                  key={column.name}
                  className="cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSort(column.name)}
                >
                  <div className="flex items-center gap-1">
                    <span>{column.displayName || column.name}</span>
                    {sort.column === column.name && (
                      <span className="text-blue-500">
                        {sort.direction === 'asc' ? (
                          <ArrowUp className="w-4 h-4" />
                        ) : (
                          <ArrowDown className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {displayColumns.map((column) => (
                  <TableCell key={column.name}>
                    {formatValue(row[column.name], column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50">
          <div className="text-sm text-gray-500">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, sortedData.length)} of{' '}
            {sortedData.length}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage(0)}
              disabled={page === 0}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 text-sm">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
