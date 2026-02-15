'use client';

import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers3, Shield, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar, getSectionFromPath, type NavSection } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { canAccessOrgAdmin, canAccessPlatformAdmin } = useAuth();
  const activeSection = getSectionFromPath(pathname);

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

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="h-14 border-b border-border/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-4">
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
