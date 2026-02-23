'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface WorkstreamOption {
  id: string;
  name: string;
}

interface WorkstreamFilterBarProps {
  workstreams: WorkstreamOption[];
  selectedWorkstreamId?: string;
  onWorkstreamChange: (workstreamId: string | undefined) => void;
  pageLabel: string;
  pageDescription?: string;
  rightSlot?: ReactNode;
}

export function WorkstreamFilterBar({
  workstreams,
  selectedWorkstreamId,
  onWorkstreamChange,
  pageLabel,
  pageDescription,
  rightSlot,
}: WorkstreamFilterBarProps) {
  return (
    <div className="ui-shell mb-6 space-y-4 p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{pageLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {pageDescription || 'Manage data workflow entities for the selected project scope.'}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="self-start text-muted-foreground">
          <Link href="/workstreams">View Projects</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:w-80 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Project</p>
          <Select
            value={selectedWorkstreamId || 'all'}
            onValueChange={(value) => onWorkstreamChange(value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {workstreams.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rightSlot ? <div className="w-full md:flex-1 md:flex md:justify-end">{rightSlot}</div> : null}
      </div>
    </div>
  );
}
