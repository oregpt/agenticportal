'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layers3, Shield, Building2, ChevronDown, Hexagon, LogOut, User } from 'lucide-react';
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
  initialEmbedded?: boolean;
}

interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
}

export function AppLayout({ children, initialEmbedded = false }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, canAccessOrgAdmin, canAccessPlatformAdmin } = useAuth();
  const activeSection = getSectionFromPath(pathname);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(initialEmbedded);

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
    const isInIframe = window.self !== window.top;
    const embeddedByQuery = new URLSearchParams(window.location.search).get('embed') === '1';
    const embedded = isInIframe || embeddedByQuery;
    setIsEmbedded(embedded);
  }, [pathname]);

  const sectionTabs: Array<{ key: NavSection; label: string; href: string; icon: ComponentType<{ className?: string }> }> = [
    { key: 'pipeline', label: 'Home', href: '/workstreams', icon: Layers3 },
    { key: 'platform', label: 'Platform Admin', href: '/admin', icon: Shield },
  ];

  const visibleTabs = sectionTabs.filter((tab) => {
    if (tab.key === 'platform') return canAccessPlatformAdmin;
    return true;
  });

  const effectiveSection: NavSection =
    activeSection === 'platform' && !canAccessPlatformAdmin
      ? 'pipeline'
      : activeSection === 'organization' && !canAccessOrgAdmin
        ? 'pipeline'
        : activeSection;

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
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-sm">
                <Hexagon className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-sm text-foreground tracking-tight">
                Agentic<span className="text-primary">Portal</span>
              </span>
            </Link>
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
            {canAccessOrgAdmin ? (
              <Link
                href="/org"
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  activeSection === 'organization'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Building2 className="h-4 w-4" />
                Organization
              </Link>
            ) : null}

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                    aria-label="Open user menu"
                  >
                    {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium truncate">{user.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuItem onClick={() => router.push('/org/settings')}>
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
