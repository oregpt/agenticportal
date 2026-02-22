'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { FolderKanban } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WorkstreamOption {
  id: string;
  name: string;
}

interface WorkstreamFilterBarProps {
  workstreams: WorkstreamOption[];
  selectedWorkstreamId?: string;
  onWorkstreamChange: (workstreamId: string | undefined) => void;
  pageLabel: string;
  rightSlot?: ReactNode;
}

export function WorkstreamFilterBar({
  workstreams,
  selectedWorkstreamId,
  onWorkstreamChange,
  pageLabel,
  rightSlot,
}: WorkstreamFilterBarProps) {
  const selectedWorkstream = workstreams.find((ws) => ws.id === selectedWorkstreamId);
  const selectedLabel = selectedWorkstream?.name || 'All Projects';

  return (
    <div className="ui-shell mb-6 space-y-4 p-4 md:p-5">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          Projects &gt; {selectedLabel} &gt; {pageLabel}
        </h1>
        <p className="text-sm text-muted-foreground">
          You are working inside project scope for this page.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderKanban className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedLabel}</p>
              <p className="text-xs text-muted-foreground">
                <Link href="/workstreams" className="hover:text-primary transition-colors">
                  Back to Projects
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="w-full md:w-72 space-y-1.5">
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
      </div>

      {rightSlot ? <div className="w-full md:w-auto">{rightSlot}</div> : null}
    </div>
  );
}
