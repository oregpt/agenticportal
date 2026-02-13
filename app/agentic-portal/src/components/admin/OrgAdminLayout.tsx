'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Users, Database, Settings, MessageSquare, LayoutDashboard, Building2, Bot } from 'lucide-react';

interface OrgAdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function OrgAdminLayout({ children, title, description }: OrgAdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, canAccessOrgAdmin } = useAuth();

  const navItems = [
    { label: 'Overview', href: '/org', icon: LayoutDashboard },
    { label: 'Team Members', href: '/org/members', icon: Users },
    { label: 'AI Agents', href: '/org/agents', icon: Bot },
    { label: 'Data Sources', href: '/datasources', icon: Database },
    { label: 'Settings', href: '/org/settings', icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!canAccessOrgAdmin) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Org Badge */}
            <div className="bg-indigo-900 text-white p-4 rounded-lg">
              <div className="text-xs font-mono text-indigo-300 mb-1">ORGANIZATION</div>
              <div className="font-bold">{user.organizationName || 'My Organization'}</div>
              <div className="text-sm text-indigo-300 mt-1 capitalize">{user.role.replace('_', ' ')}</div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/org' && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-white dark:bg-zinc-800 text-primary shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700'
                        : 'text-muted-foreground hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Platform Admin Link */}
            {user.isPlatformAdmin && (
              <div className="pt-4 border-t">
                <Link
                  href="/admin"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                >
                  → Platform Admin
                </Link>
              </div>
            )}
          </aside>

          {/* Main Content */}
          <main>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
