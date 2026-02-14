'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Table2, Search, Code, MessageSquare, Database, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface View {
  id: string;
  name: string;
  description: string | null;
  dataSourceId: string;
  sql: string;
  columns: { name: string; type: string }[];
  createdAt: string;
  updatedAt: string;
}

export default function ViewsPage() {
  const [views, setViews] = useState<View[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchViews = async () => {
      try {
        const response = await fetch('/api/views');
        if (response.ok) {
          const data = await response.json();
          setViews(data.views || []);
        }
      } catch (error) {
        console.error('Failed to fetch views:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchViews();
  }, []);

  const filteredViews = views.filter(view => 
    view.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (view.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Views List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredViews.length === 0 && views.length === 0 ? (
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
      ) : filteredViews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No views match your search
        </div>
      ) : (
        <div className="space-y-4">
          {filteredViews.map((view) => (
            <Link key={view.id} href={`/views/${view.id}`}>
              <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Table2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{view.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{view.description || 'No description'}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5" />
                          {view.dataSourceId}
                        </span>
                        <span>{Array.isArray(view.columns) ? view.columns.length : 0} columns</span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(view.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    <Code className="w-3 h-3 mr-1" /> SQL View
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
