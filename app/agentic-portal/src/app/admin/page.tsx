'use client';

import { Building2, Users, Database, MessageSquare, ArrowRight, Settings, Plug } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PlatformStats {
  totalOrganizations: number;
  totalUsers: number;
  totalDataSources: number;
  totalChatSessions: number;
}

export default function PlatformAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Organizations',
      value: isLoading ? '...' : stats?.totalOrganizations || 0,
      label: 'Active tenants',
      icon: Building2,
      href: '/admin/organizations',
    },
    {
      title: 'Users',
      value: isLoading ? '...' : stats?.totalUsers || 0,
      label: 'Across all orgs',
      icon: Users,
      href: '/admin/users',
    },
    {
      title: 'Data Sources',
      value: isLoading ? '...' : stats?.totalDataSources || 0,
      label: 'Connected databases',
      icon: Database,
      href: '/admin/datasources',
    },
    {
      title: 'Chat Sessions',
      value: isLoading ? '...' : stats?.totalChatSessions || 0,
      label: 'Total conversations',
      icon: MessageSquare,
      href: '/admin',
    },
  ];

  const quickActions = [
    {
      title: 'Organizations',
      description: 'Manage organizations, create new tenants',
      icon: Building2,
      href: '/admin/organizations',
    },
    {
      title: 'User Management',
      description: 'View and manage all platform users',
      icon: Users,
      href: '/admin/users',
    },
    {
      title: 'MCP Servers',
      description: 'Configure platform-wide MCP servers',
      icon: Plug,
      href: '/admin/mcp',
    },
    {
      title: 'Platform Settings',
      description: 'API keys, limits, and global config',
      icon: Settings,
      href: '/admin/settings',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Platform Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of all organizations and platform activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href}>
              <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <action.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                      {action.title}
                      <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                    </h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
