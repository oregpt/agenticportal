'use client';

import { useState, useEffect, use } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Play, 
  Copy, 
  Trash2, 
  Edit2, 
  Table2, 
  BarChart3,
  Code,
  Loader2,
  AlertCircle,
  Clock,
  Database
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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

interface QueryResult {
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

export default function ViewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  
  const [view, setView] = useState<View | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchView = async () => {
      try {
        const response = await fetch(`/api/views/${id}`);
        if (response.ok) {
          const data = await response.json();
          setView(data.view);
        } else {
          setError('View not found');
        }
      } catch (err) {
        setError('Failed to load view');
      } finally {
        setIsLoading(false);
      }
    };

    fetchView();
  }, [id]);

  const handleRunQuery = async () => {
    if (!view) return;
    
    setIsRunning(true);
    setError(null);
    
    try {
      // Get organizationId from the view's data source
      const dsResponse = await fetch(`/api/datasources/${view.dataSourceId}`);
      let orgId = '';
      if (dsResponse.ok) {
        const dsData = await dsResponse.json();
        orgId = dsData.dataSource?.organizationId || '';
      }
      
      const response = await fetch(`/api/datasources/${view.dataSourceId}/query?organizationId=${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: view.sql }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.result);
      } else {
        const data = await response.json();
        setError(data.error || 'Query failed');
      }
    } catch (err) {
      setError('Failed to execute query');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this view?')) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/views/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast({ title: 'View deleted' });
        router.push('/views');
      } else {
        toast({ title: 'Failed to delete view', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Failed to delete view', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">View not found</h2>
          <p className="text-muted-foreground mb-4">{error || 'The requested view does not exist.'}</p>
          <Button asChild>
            <Link href="/views">Back to Views</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/views">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{view.name}</h1>
          <p className="text-muted-foreground">{view.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => copyToClipboard(view.sql)}>
            <Copy className="w-4 h-4 mr-2" />
            Copy SQL
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button onClick={handleRunQuery} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run Query
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground mb-6">
        <span className="flex items-center gap-1.5">
          <Database className="w-4 h-4" />
          {view.dataSourceId}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Updated {formatDate(view.updatedAt)}
        </span>
        <Badge variant="secondary">
          <Code className="w-3 h-3 mr-1" />
          SQL View
        </Badge>
      </div>

      {/* SQL */}
      <Card className="mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <span className="text-sm font-medium text-muted-foreground">SQL Query</span>
        </div>
        <pre className="p-4 overflow-x-auto text-sm">
          <code>{view.sql}</code>
        </pre>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-sm text-destructive/80 mt-2">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <span className="text-sm text-muted-foreground">
              {results.rowCount} rows • {results.executionTimeMs}ms
            </span>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr className="border-b">
                  {results.columns.map((col) => (
                    <th key={col.name} className="text-left px-4 py-2 font-medium">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-b">
                    {results.columns.map((col) => (
                      <td key={col.name} className="px-4 py-2">
                        {String(row[col.name] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.rowCount > 100 && (
            <div className="text-center py-3 text-sm text-muted-foreground border-t">
              Showing 100 of {results.rowCount} rows
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
