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
  MessageSquare,
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Data Sources', href: '/datasources', icon: Database },
  { name: 'Views', href: '/views', icon: Table2 },
  { name: 'Dashboards', href: '/dashboards', icon: LayoutDashboard },
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

// Mock organizations - in production this would come from the user context
const mockOrganizations = [
  { id: '1', name: 'ClarkAI', slug: 'clarkai' },
  { id: '2', name: 'Agenticledger', slug: 'agenticledger' },
  { id: '3', name: 'Demo Org', slug: 'demo' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, canAccessPlatformAdmin, canAccessOrgAdmin } = useAuth();
  const [currentOrg, setCurrentOrg] = useState(mockOrganizations[0]);

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo - AgenticPortal (one word) */}
      <div className="flex h-16 items-center px-5 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* Clean geometric logo icon */}
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Hexagon className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-lg text-sidebar-foreground tracking-tight">
            Agentic<span className="text-primary">Portal</span>
          </span>
        </Link>
      </div>

      {/* Organization Switcher */}
      {user && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-sidebar-border hover:bg-sidebar-accent transition-colors">
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Main Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Main
          </p>
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Organization */}
        {user && canAccessOrgAdmin && (
          <div className="mt-6 space-y-1">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Organization
            </p>
            {orgNavigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/org' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Platform Admin */}
        {user && canAccessPlatformAdmin && (
          <div className="mt-6 space-y-1">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Platform Admin
            </p>
            {platformNavigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-3">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
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
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
