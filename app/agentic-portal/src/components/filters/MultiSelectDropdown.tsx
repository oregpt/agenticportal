'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  emptyLabel?: string;
}

export function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  emptyLabel = 'All',
}: MultiSelectDropdownProps) {
  const selectedCount = selectedValues.length;
  const buttonLabel = selectedCount === 0 ? emptyLabel : `${selectedCount} selected`;

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((item) => item !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate">{buttonLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedValues.includes(option.value)}
              onCheckedChange={() => toggleValue(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {selectedValues.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <button
                onClick={() => onChange([])}
                className="w-full px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted rounded-sm"
              >
                Clear selection
              </button>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {selectedValues.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedValues.slice(0, 3).map((value) => {
            const option = options.find((item) => item.value === value);
            if (!option) return null;
            return (
              <span key={value} className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-xs">
                <Check className="h-3 w-3" />
                {option.label}
              </span>
            );
          })}
          {selectedValues.length > 3 ? (
            <span className="inline-flex rounded-full border border-border bg-white px-2 py-0.5 text-xs text-muted-foreground">
              +{selectedValues.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
