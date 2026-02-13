'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Users, Database, MessageSquare, TrendingUp, ArrowRight, Bot, Settings } from 'lucide-react';
import Link from 'next/link';

interface OrgStats {
  userCount: number;
  dataSourceCount: number;
  chatSessionCount: number;
  queryCount: number;
}

export default function OrgAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user?.organizationId) return;
      
      try {
        const res = await fetch(`/api/org/stats?organizationId=${user.organizationId}`);
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
  }, [user?.organizationId]);

  const statCards = [
    {
      title: 'Team Members',
      value: isLoading ? '...' : stats?.userCount || 0,
      label: 'Active users',
      icon: Users,
      href: '/org/members',
    },
    {
      title: 'Data Sources',
      value: isLoading ? '...' : stats?.dataSourceCount || 0,
      label: 'Connected',
      icon: Database,
      href: '/datasources',
    },
    {
      title: 'Chat Sessions',
      value: isLoading ? '...' : stats?.chatSessionCount || 0,
      label: 'This month',
      icon: MessageSquare,
      href: '/chat',
    },
    {
      title: 'Queries Run',
      value: isLoading ? '...' : stats?.queryCount || 0,
      label: 'Total queries',
      icon: TrendingUp,
      href: '/dashboards',
    },
  ];

  const quickActions = [
    {
      title: 'Manage Team',
      description: 'Invite members, manage roles and permissions',
      icon: Users,
      href: '/org/members',
    },
    {
      title: 'Configure Agents',
      description: 'Set up AI agents with custom instructions',
      icon: Bot,
      href: '/org/agents',
    },
    {
      title: 'Organization Settings',
      description: 'Billing, API keys, and preferences',
      icon: Settings,
      href: '/org/settings',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Organization Overview</h1>
        <p className="text-muted-foreground mt-1">Manage your organization's data and team</p>
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
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
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

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Activity feed coming soon</p>
        </div>
      </div>
    </div>
  );
}
