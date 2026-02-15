'use client';

import { useState } from 'react';
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
  LogOut,
  Shield,
  Plug,
  ChevronDown,
  Check,
  Plus,
  Hexagon,
  Workflow,
  FileOutput,
  Sparkles,
  Network,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type NavSection = 'pipeline' | 'organization' | 'platform';

export function getSectionFromPath(pathname: string): NavSection {
  if (pathname.startsWith('/admin')) return 'platform';
  if (pathname.startsWith('/org')) return 'organization';
  return 'pipeline';
}

const pipelineNavigation = [
  { name: 'Workstreams', href: '/workstreams', icon: Workflow },
  { name: 'Data Sources', href: '/datasources', icon: Database },
  { name: 'Views', href: '/views', icon: Table2 },
  { name: 'Dashboards', href: '/dashboards', icon: LayoutDashboard },
  { name: 'Outputs', href: '/outputs', icon: FileOutput },
  { name: 'Relationship Explorer', href: '/relationship-explorer', icon: Network },
];

const aiNavigation = [
  { name: 'AI Chat', href: '/chat', icon: Sparkles },
];

const orgNavigation = [
  { name: 'Overview', href: '/org', icon: LayoutDashboard },
  { name: 'Team', href: '/org/members', icon: Users },
  { name: 'Agents', href: '/org/agents', icon: Bot },
  { name: 'MCP Hub', href: '/org/mcp', icon: Plug },
  { name: 'Settings', href: '/org/settings', icon: Settings },
];

const platformNavigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { name: 'All Users', href: '/admin/users', icon: Users },
  { name: 'Data Sources', href: '/admin/datasources', icon: Database },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

const mockOrganizations = [
  { id: '1', name: 'ClarkAI', slug: 'clarkai' },
  { id: '2', name: 'Agenticledger', slug: 'agenticledger' },
  { id: '3', name: 'Demo Org', slug: 'demo' },
];

const sectionMeta: Record<NavSection, { label: string; description: string }> = {
  pipeline: {
    label: 'Pipeline',
    description: 'Build data sources, views, dashboards, and outputs',
  },
  organization: {
    label: 'Organization',
    description: 'Manage team members, agents, and org settings',
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
  const { user, logout, canAccessPlatformAdmin, canAccessOrgAdmin } = useAuth();
  const [currentOrg, setCurrentOrg] = useState(mockOrganizations[0]);

  const navGroups =
    section === 'pipeline'
      ? [
          { title: 'Pipeline', items: pipelineNavigation },
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
    : [{ title: 'Pipeline', items: pipelineNavigation }];
  const meta = sectionMeta[section];

  return (
    <div className="flex h-full w-72 flex-col bg-sidebar/90 backdrop-blur-md border-r border-sidebar-border shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="flex h-16 items-center px-5 border-b border-sidebar-border/80">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-sm">
            <Hexagon className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-lg text-sidebar-foreground tracking-tight">
            Agentic<span className="text-primary">Portal</span>
          </span>
        </Link>
      </div>

      {user && (
        <div className="px-3 py-3 border-b border-sidebar-border/80">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-sidebar-border hover:bg-sidebar-accent transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-sidebar-foreground">{currentOrg.name}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {mockOrganizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => setCurrentOrg(org)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>{org.name}</span>
                  </div>
                  {currentOrg.id === org.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-primary">
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

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

      <div className="border-t border-sidebar-border/80 p-3">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/60 border border-sidebar-border/60">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate flex items-center gap-1.5">
                  {user.name || 'User'}
                  {user.role === 'platform_admin' && (
                    <Shield className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
