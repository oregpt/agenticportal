'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Table2, Search, Code, MessageSquare, Database, Clock } from 'lucide-react';
import Link from 'next/link';

export default function ViewsPage() {
  // TODO: Fetch from API
  const views = [
    {
      id: '1',
      name: 'Top Customers',
      description: 'Top 100 customers by revenue',
      dataSource: 'Production DB',
      columns: 8,
      createdVia: 'chat',
      naturalLanguageQuery: 'Show me top 100 customers by total revenue',
      updatedAt: '2 hours ago',
    },
    {
      id: '2',
      name: 'Monthly Sales',
      description: 'Sales aggregated by month',
      dataSource: 'Production DB',
      columns: 5,
      createdVia: 'sql',
      updatedAt: '1 day ago',
    },
    {
      id: '3',
      name: 'Product Performance',
      description: 'Product metrics with YoY comparison',
      dataSource: 'Analytics Warehouse',
      columns: 12,
      createdVia: 'chat',
      naturalLanguageQuery: 'Product performance metrics comparing this year vs last year',
      updatedAt: '3 days ago',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Views</h1>
          <p className="text-muted-foreground mt-1">Saved queries ready to use in dashboards</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild className="hover:bg-primary/5 hover:text-primary hover:border-primary/30">
            <Link href="/views/new?mode=sql">
              <Code className="w-4 h-4 mr-2" />
              Write SQL
            </Link>
          </Button>
          <Button className="bg-primary hover:bg-primary/90" asChild>
            <Link href="/chat">
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask AI
            </Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search views..."
          className="pl-10 max-w-md border-border bg-card"
        />
      </div>

      {/* Views List */}
      {views.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Table2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No views yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Create your first view by asking AI or writing SQL</p>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/views/new?mode=sql">
                  <Code className="w-4 h-4 mr-2" />
                  Write SQL
                </Link>
              </Button>
              <Button className="bg-primary hover:bg-primary/90" asChild>
                <Link href="/chat">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Ask AI
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {views.map((view) => (
            <Link key={view.id} href={`/views/${view.id}`}>
              <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Table2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{view.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{view.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5" />
                          {view.dataSource}
                        </span>
                        <span>{view.columns} columns</span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {view.updatedAt}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={view.createdVia === 'chat' ? 'bg-primary/10 text-primary border-0' : ''}
                  >
                    {view.createdVia === 'chat' ? (
                      <><MessageSquare className="w-3 h-3 mr-1" /> AI Generated</>
                    ) : (
                      <><Code className="w-3 h-3 mr-1" /> Custom SQL</>
                    )}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
