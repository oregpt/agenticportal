'use client';

import { useMemo, useState } from 'react';
import { Save, Bookmark, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface FilterPreset {
  id: string;
  name: string;
  query: string;
}

interface FilterPresetManagerProps {
  pageKey: string;
  currentQuery: string;
  onApply: (query: string) => void;
}

const STORAGE_PREFIX = 'agenticportal.filterPresets.';

export function FilterPresetManager({ pageKey, currentQuery, onApply }: FilterPresetManagerProps) {
  const storageKey = `${STORAGE_PREFIX}${pageKey}`;
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as FilterPreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [newPresetName, setNewPresetName] = useState('');

  const persist = (next: FilterPreset[]) => {
    setPresets(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const canSaveCurrent = useMemo(() => currentQuery.trim().length > 0, [currentQuery]);

  const savePreset = () => {
    if (!canSaveCurrent) return;
    const name = newPresetName.trim() || `Preset ${presets.length + 1}`;
    const next: FilterPreset[] = [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name,
        query: currentQuery,
      },
      ...presets,
    ].slice(0, 20);
    persist(next);
    setNewPresetName('');
  };

  const deletePreset = (id: string) => {
    persist(presets.filter((preset) => preset.id !== id));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Bookmark className="h-4 w-4" />
          Presets
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Filter Presets</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-2 p-2">
          <Input
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Preset name"
          />
          <Button className="w-full gap-2" onClick={savePreset} disabled={!canSaveCurrent}>
            <Save className="h-4 w-4" />
            Save Current Filters
          </Button>
        </div>
        <DropdownMenuSeparator />
        {presets.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No presets saved yet.</div>
        ) : (
          presets.map((preset) => (
            <DropdownMenuItem key={preset.id} className="flex items-center justify-between gap-2" onSelect={(e) => e.preventDefault()}>
              <button
                onClick={() => onApply(preset.query)}
                className="min-w-0 flex-1 truncate text-left"
                title={preset.name}
              >
                {preset.name}
              </button>
              <button
                onClick={() => deletePreset(preset.id)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label="Delete preset"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
