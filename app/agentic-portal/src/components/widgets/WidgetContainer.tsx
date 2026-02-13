/**
 * WidgetContainer Component
 *
 * Wrapper for all widget types with:
 * - Title bar with refresh button
 * - Resize handles (for dashboard builder)
 * - Loading/error states
 */
'use client';

import React, { useState, useCallback } from 'react';
import { RefreshCw, Settings, X, Maximize2, Minimize2, AlertCircle, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Widget } from '@/types';

export interface WidgetContainerProps {
  widget: Widget;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onResize?: (width: number, height: number) => void;
  editMode?: boolean;
  className?: string;
}

export default function WidgetContainer({
  widget,
  children,
  isLoading = false,
  error = null,
  onRefresh,
  onRemove,
  onEdit,
  onResize,
  editMode = false,
  className,
}: WidgetContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: 'se' | 'e' | 's') => {
      if (!onResize || !editMode) return;

      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const container = e.currentTarget.closest('[data-widget-container]') as HTMLElement;
      if (!container) return;

      const startWidth = container.offsetWidth;
      const startHeight = container.offsetHeight;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        if (direction === 'se' || direction === 'e') {
          newWidth = Math.max(200, startWidth + deltaX);
        }
        if (direction === 'se' || direction === 's') {
          newHeight = Math.max(150, startHeight + deltaY);
        }

        onResize(newWidth, newHeight);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResize, editMode]
  );

  // Get widget type icon
  const getWidgetTypeLabel = () => {
    switch (widget.type) {
      case 'table':
        return 'Table';
      case 'bar':
        return 'Bar Chart';
      case 'line':
        return 'Line Chart';
      case 'area':
        return 'Area Chart';
      case 'pie':
        return 'Pie Chart';
      case 'donut':
        return 'Donut Chart';
      case 'scatter':
        return 'Scatter Plot';
      case 'metric':
        return 'Metric';
      case 'pivot':
        return 'Pivot Table';
      default:
        return 'Widget';
    }
  };

  return (
    <div
      data-widget-container
      className={cn(
        'rounded-lg border bg-white shadow-sm h-full flex flex-col relative',
        {
          'ring-2 ring-blue-500': editMode,
          'ring-2 ring-blue-400 ring-opacity-50': isResizing,
        },
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b bg-slate-50 rounded-t-lg',
          {
            'cursor-move': editMode,
          }
        )}
      >
        {/* Drag handle (only in edit mode) */}
        {editMode && (
          <div className="mr-2 text-gray-400 cursor-move">
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Title */}
        <h3
          className="text-sm font-medium text-gray-900 truncate flex-1"
          title={widget.title}
        >
          {widget.title}
        </h3>

        {/* Type badge */}
        <span className="hidden sm:inline-block text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded mr-2">
          {getWidgetTypeLabel()}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {/* Refresh Button */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-gray-400 hover:text-blue-500"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh data"
            >
              <RefreshCw className={cn('w-4 h-4', { 'animate-spin': isLoading })} />
            </Button>
          )}

          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>

          {/* Settings Menu */}
          {(onEdit || onRemove) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Widget
                  </DropdownMenuItem>
                )}
                {onRemove && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onRemove}
                      className="text-red-600 focus:text-red-600"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove Widget
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 min-h-0 overflow-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm text-center">{error}</p>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={onRefresh}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Resize Handles (only in edit mode) */}
      {editMode && onResize && (
        <>
          {/* Right edge */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-400 opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-0 w-full h-1 cursor-ns-resize hover:bg-blue-400 opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          {/* Corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          >
            <svg
              className="w-4 h-4 text-gray-300 hover:text-blue-400 transition-colors"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
