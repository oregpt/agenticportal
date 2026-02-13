/**
 * DashboardGrid Component
 *
 * Grid layout for widgets. Simple CSS grid for MVP.
 * TODO: Add drag-and-drop with react-grid-layout later
 */
'use client';

import React from 'react';
import { Plus, LayoutGrid, Save, RefreshCw, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Widget, WidgetType } from '@/types';

export interface DashboardGridProps {
  widgets: Widget[];
  isEditing?: boolean;
  onAddWidget?: (type: WidgetType) => void;
  onRemoveWidget?: (widgetId: string) => void;
  onWidgetRefresh?: (widgetId: string) => void;
  onSave?: () => void;
  renderWidget: (widget: Widget) => React.ReactNode;
}

const WIDGET_TYPES: { type: WidgetType; label: string; icon: string }[] = [
  { type: 'table', label: 'Table', icon: '📊' },
  { type: 'bar', label: 'Bar Chart', icon: '📊' },
  { type: 'line', label: 'Line Chart', icon: '📈' },
  { type: 'pie', label: 'Pie Chart', icon: '🥧' },
  { type: 'metric', label: 'Metric Card', icon: '🔢' },
];

export function DashboardGrid({
  widgets,
  isEditing = false,
  onAddWidget,
  onRemoveWidget,
  onWidgetRefresh,
  onSave,
  renderWidget,
}: DashboardGridProps) {
  return (
    <div className="p-6">
      {/* Toolbar */}
      {isEditing && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-zinc-500" />
            <span className="text-sm text-zinc-500">
              {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Widget
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {WIDGET_TYPES.map((wt) => (
                  <DropdownMenuItem
                    key={wt.type}
                    onClick={() => onAddWidget?.(wt.type)}
                  >
                    <span className="mr-2">{wt.icon}</span>
                    {wt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={onSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Widget Grid */}
      {widgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {widgets.map((widget) => (
            <Card key={widget.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{widget.title || 'Untitled'}</CardTitle>
                  <div className={cn(
                    'flex items-center gap-1',
                    isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onWidgetRefresh?.(widget.id)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    {isEditing && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => onRemoveWidget?.(widget.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-64">
                {renderWidget(widget)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutGrid className="w-12 h-12 text-zinc-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No widgets yet</h3>
            <p className="text-zinc-500 mb-4 text-center">
              Add widgets to visualize your data
            </p>
            {isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Widget
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {WIDGET_TYPES.map((wt) => (
                    <DropdownMenuItem
                      key={wt.type}
                      onClick={() => onAddWidget?.(wt.type)}
                    >
                      <span className="mr-2">{wt.icon}</span>
                      {wt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DashboardGrid;
