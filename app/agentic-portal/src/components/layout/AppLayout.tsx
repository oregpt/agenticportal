'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layers3, Shield, Building2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar, getSectionFromPath, type NavSection } from './Sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppLayoutProps {
  children: ReactNode;
}

interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, canAccessOrgAdmin, canAccessPlatformAdmin } = useAuth();
  const activeSection = getSectionFromPath(pathname);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
        const res = await fetch('/api/auth/organizations');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        setOrganizations(data.organizations || []);
        setActiveOrganizationId(data.activeOrganizationId || null);
      } catch {
        // Keep layout resilient if org context endpoint fails.
      }
    }

    loadOrganizations();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const embedded = new URLSearchParams(window.location.search).get('embed') === '1';
    setIsEmbedded(embedded);
  }, [pathname]);

  const sectionTabs: Array<{ key: NavSection; label: string; href: string; icon: ComponentType<{ className?: string }> }> = [
    { key: 'pipeline', label: 'Pipeline', href: '/workstreams', icon: Layers3 },
    { key: 'organization', label: 'Organization', href: '/org', icon: Building2 },
    { key: 'platform', label: 'Platform Admin', href: '/admin', icon: Shield },
  ];

  const visibleTabs = sectionTabs.filter((tab) => {
    if (tab.key === 'organization') return canAccessOrgAdmin;
    if (tab.key === 'platform') return canAccessPlatformAdmin;
    return true;
  });

  const effectiveSection =
    visibleTabs.some((tab) => tab.key === activeSection)
      ? activeSection
      : (visibleTabs[0]?.key ?? 'pipeline');

  const activeOrg = useMemo(
    () => organizations.find((org) => org.id === activeOrganizationId) || null,
    [organizations, activeOrganizationId]
  );

  async function switchOrganization(nextOrganizationId: string) {
    if (!nextOrganizationId || nextOrganizationId === activeOrganizationId || isSwitchingOrg) return;
    setIsSwitchingOrg(true);

    try {
      const res = await fetch('/api/auth/switch-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: nextOrganizationId }),
      });
      if (!res.ok) return;
      setActiveOrganizationId(nextOrganizationId);
      router.refresh();
    } finally {
      setIsSwitchingOrg(false);
    }
  }

  if (isEmbedded) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="h-14 border-b border-border/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            {visibleTabs.map((tab) => {
              const isActive = effectiveSection === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {organizations.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSwitchingOrg}
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[200px] truncate">{activeOrg?.name || 'Select organization'}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => switchOrganization(org.id)}
                      className={cn('flex items-center justify-between', org.id === activeOrganizationId && 'bg-muted')}
                    >
                      <span className="truncate">{org.name}</span>
                      {org.id === activeOrganizationId ? (
                        <span className="text-xs text-muted-foreground">Active</span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {user ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </div>
                <div className="max-w-[180px] leading-tight">
                  <p className="truncate text-xs font-medium">{user.name || 'User'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar section={effectiveSection} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
