'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, LayoutDashboard, Building2, Users, Settings, Database, Shield } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, canAccessPlatformAdmin } = useAuth();

  // All navigation items
  const allNavItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, platformOnly: true },
    { label: 'Organizations', href: '/admin/organizations', icon: Building2, platformOnly: false },
    { label: 'Users', href: '/admin/users', icon: Users, platformOnly: true },
    { label: 'Data Sources', href: '/admin/datasources', icon: Database, platformOnly: true },
    { label: 'Platform Settings', href: '/admin/settings', icon: Settings, platformOnly: true },
  ];

  // Filter based on role
  const navItems = canAccessPlatformAdmin
    ? allNavItems
    : allNavItems.filter(item => !item.platformOnly);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    router.push('/login');
    return null;
  }

  // Not authorized for admin
  if (!canAccessPlatformAdmin && user.role !== 'org_admin') {
    router.push('/');
    return null;
  }

  const roleDisplay = canAccessPlatformAdmin ? 'Platform Admin' : 'Organization Admin';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Role Badge */}
            <div className={cn(
              'p-4 rounded-lg',
              canAccessPlatformAdmin 
                ? 'bg-zinc-900 text-white' 
                : 'bg-indigo-900 text-white'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                <span className="text-xs font-mono text-zinc-400">CURRENT ROLE</span>
              </div>
              <div className="font-bold">{roleDisplay}</div>
              {user.organizationName && (
                <div className="text-sm text-zinc-400 mt-1">{user.organizationName}</div>
              )}
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/admin' && pathname.startsWith(item.href));
                
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
