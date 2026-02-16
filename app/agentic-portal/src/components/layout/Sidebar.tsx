'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Database,
  Table2,
  Settings,
  Users,
  Building2,
  Bot,
  Plug,
  Workflow,
  FileOutput,
  Sparkles,
  Network,
} from 'lucide-react';

export type NavSection = 'pipeline' | 'organization' | 'platform';

export function getSectionFromPath(pathname: string): NavSection {
  if (pathname.startsWith('/admin')) return 'platform';
  if (pathname.startsWith('/org')) return 'organization';
  return 'pipeline';
}

const pipelineNavigation = [
  { name: 'Pipelines', href: '/workstreams', icon: Workflow },
  { name: 'Data Sources', href: '/datasources', icon: Database },
  { name: 'Views', href: '/views', icon: Table2 },
  { name: 'Dashboards', href: '/dashboards', icon: LayoutDashboard },
  { name: 'Exports', href: '/outputs', icon: FileOutput },
  { name: 'Data Relationships', href: '/relationship-explorer', icon: Network },
];

const aiNavigation = [
  { name: 'Ask Data Assistant', href: '/chat', icon: Sparkles },
];

const orgNavigation = [
  { name: 'Overview', href: '/org', icon: LayoutDashboard },
  { name: 'Team', href: '/org/members', icon: Users },
  { name: 'AI Assistants', href: '/org/agents', icon: Bot },
  { name: 'Tool Integrations', href: '/org/mcp', icon: Plug },
  { name: 'Settings', href: '/org/settings', icon: Settings },
];

const platformNavigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { name: 'All Users', href: '/admin/users', icon: Users },
  { name: 'Data Sources', href: '/admin/datasources', icon: Database },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

const sectionMeta: Record<NavSection, { label: string; description: string }> = {
  pipeline: {
    label: 'Pipeline',
    description: 'Connect data, save queries, and build dashboards',
  },
  organization: {
    label: 'Organization',
    description: 'Manage team, assistants, and organization settings',
  },
  platform: {
    label: 'Platform Admin',
    description: 'Global administration for all organizations',
  },
};

interface SidebarProps {
  section: NavSection;
}

export function Sidebar({ section }: SidebarProps) {
  const pathname = usePathname();
  const { canAccessPlatformAdmin, canAccessOrgAdmin } = useAuth();
  const [hasDataSources, setHasDataSources] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function loadSetupState() {
      try {
        const res = await fetch('/api/datasources');
        if (!res.ok || !active) return;
        const payload = await res.json();
        if (!active) return;
        setHasDataSources((payload?.dataSources || []).length > 0);
      } catch {
        // Keep defaults when setup state is unavailable.
      }
    }
    loadSetupState();
    return () => {
      active = false;
    };
  }, []);

  const orgBaseItems = orgNavigation.filter((item) => item.href === '/org' || item.href === '/org/members' || item.href === '/org/settings');
  const orgAdvancedItems = orgNavigation.filter((item) => item.href === '/org/agents' || item.href === '/org/mcp');

  const navGroups =
    section === 'pipeline'
      ? [
          { title: 'Pipeline', items: pipelineNavigation },
          { title: 'AI Tools', items: aiNavigation },
        ]
      : section === 'organization'
        ? [
            { title: 'Organization', items: orgBaseItems },
            ...(hasDataSources ? [{ title: 'Advanced', items: orgAdvancedItems }] : []),
          ]
        : [{ title: 'Platform Admin', items: platformNavigation }];

  const canViewSection =
    section === 'platform'
      ? canAccessPlatformAdmin
      : section === 'organization'
        ? canAccessOrgAdmin
        : true;

  const effectiveGroups = canViewSection
    ? navGroups
    : [{ title: 'Pipeline', items: pipelineNavigation }];
  const meta = sectionMeta[section];

  return (
    <div className="flex h-full w-72 flex-col bg-sidebar/90 backdrop-blur-md border-r border-sidebar-border shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-4 rounded-xl border border-sidebar-border/60 bg-white/50 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {meta.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {meta.description}
          </p>
        </div>

        {effectiveGroups.map((group, idx) => (
          <div key={group.title} className={cn('space-y-1', idx > 0 && 'mt-6')}>
            <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">
              {group.title}
            </p>
            {group.items.map((item) => {
              const isRootSectionItem = item.href === '/org' || item.href === '/admin';
              const isActive =
                pathname === item.href ||
                (!isRootSectionItem && pathname.startsWith(item.href + '/'));
              const isAiTool = group.title === 'AI Tools';
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    isActive && isAiTool
                      ? 'bg-gradient-to-r from-primary to-teal text-white shadow-sm'
                      : isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}

