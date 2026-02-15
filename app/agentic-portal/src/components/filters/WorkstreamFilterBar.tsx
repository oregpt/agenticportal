'use client';

import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WorkstreamOption {
  id: string;
  name: string;
}

interface WorkstreamFilterBarProps {
  workstreams: WorkstreamOption[];
  selectedWorkstreamId?: string;
  onWorkstreamChange: (workstreamId: string | undefined) => void;
  rightSlot?: ReactNode;
}

export function WorkstreamFilterBar({
  workstreams,
  selectedWorkstreamId,
  onWorkstreamChange,
  rightSlot,
}: WorkstreamFilterBarProps) {
  return (
    <div className="ui-shell mb-6 flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
      <div className="w-full max-w-sm space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Context</p>
        <Select
          value={selectedWorkstreamId || 'all'}
          onValueChange={(value) => onWorkstreamChange(value === 'all' ? undefined : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All workstreams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workstreams</SelectItem>
            {workstreams.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rightSlot ? <div className="w-full md:w-auto">{rightSlot}</div> : null}
    </div>
  );
}
