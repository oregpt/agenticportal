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
  Workflow,
  FileOutput,
  Network,
} from 'lucide-react';

export type NavSection = 'pipeline' | 'organization' | 'platform';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function getSectionFromPath(pathname: string): NavSection {
  if (pathname.startsWith('/admin')) return 'platform';
  if (pathname.startsWith('/org')) return 'organization';
  return 'pipeline';
}

const pipelineNavigation: NavItem[] = [
  { name: 'All Projects', href: '/workstreams', icon: Workflow },
  { name: 'Data Sources', href: '/datasources', icon: Database },
  { name: 'Views', href: '/views', icon: Table2 },
  { name: 'Dashboards', href: '/dashboards', icon: LayoutDashboard },
  { name: 'Outputs', href: '/outputs', icon: FileOutput },
  { name: 'Data Relationships', href: '/relationship-explorer', icon: Network },
];

const aiNavigation: NavItem[] = [
  { name: 'Project Agent', href: '/project-agent', icon: Bot },
];

const orgNavigation: NavItem[] = [
  { name: 'Overview', href: '/org', icon: LayoutDashboard },
  { name: 'Team', href: '/org/members', icon: Users },
  { name: 'Settings', href: '/org/settings', icon: Settings },
];

const platformNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { name: 'All Users', href: '/admin/users', icon: Users },
  { name: 'Data Sources', href: '/admin/datasources', icon: Database },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

const sectionMeta: Record<NavSection, { label: string; description: string }> = {
  pipeline: {
    label: 'Projects',
    description: 'Manage projects and build your data pipeline',
  },
  organization: {
    label: 'Organization',
    description: 'Manage team and organization settings',
  },
  platform: {
    label: 'Platform Admin',
    description: 'Global administration for all organizations',
  },
};

interface SidebarProps {
  section: NavSection;
}

function getPipelinePageMeta(pathname: string): { label: string; description: string } {
  if (pathname.startsWith('/datasources')) return { label: 'Data Sources', description: 'Connect and assign data sources across projects.' };
  if (pathname.startsWith('/views')) return { label: 'Views', description: 'Model reusable query views for project reporting.' };
  if (pathname.startsWith('/dashboards')) return { label: 'Dashboards', description: 'Build and manage dashboards for each project.' };
  if (pathname.startsWith('/outputs')) return { label: 'Outputs', description: 'Deliver project insights through scheduled outputs.' };
  if (pathname.startsWith('/relationship-explorer')) return { label: 'Data Relationships', description: 'Explore table and entity relationships by project.' };
  if (pathname.startsWith('/project-agent')) return { label: 'Project Agent', description: 'Configure and use the project-scoped data agent.' };
  return { label: 'Projects', description: 'Manage projects and build your data pipeline.' };
}

export function Sidebar({ section }: SidebarProps) {
  const pathname = usePathname();
  const { canAccessPlatformAdmin, canAccessOrgAdmin } = useAuth();

  const navGroups =
    section === 'pipeline'
      ? [
          { title: '', items: pipelineNavigation },
          { title: 'AI Tools', items: aiNavigation },
        ]
      : section === 'organization'
        ? [{ title: 'Organization', items: orgNavigation }]
        : [{ title: 'Platform Admin', items: platformNavigation }];

  const canViewSection =
    section === 'platform'
      ? canAccessPlatformAdmin
      : section === 'organization'
        ? canAccessOrgAdmin
        : true;

  const effectiveGroups = canViewSection
    ? navGroups
    : [{ title: 'Projects', items: pipelineNavigation }];
  const meta = section === 'pipeline' ? getPipelinePageMeta(pathname) : sectionMeta[section];

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
            {group.title ? (
              <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">
                {group.title}
              </p>
            ) : null}
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

