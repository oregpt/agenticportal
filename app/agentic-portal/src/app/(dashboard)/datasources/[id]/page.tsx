'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Database, RefreshCw, Trash2, Table2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataSource {
  id: string;
  name: string;
  type: string;
  schemaCache?: {
    tables?: Array<{
      name: string;
      columns: Array<{ name: string; type: string; nullable: boolean }>;
    }>;
    lastRefreshed?: string;
  };
  lastSyncedAt?: string;
  createdAt: string;
}

export default function DataSourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchDataSource() {
      try {
        const res = await fetch(`/api/datasources/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDataSource(data.dataSource);
        } else {
          router.push('/datasources');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDataSource();
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm('Delete this data source? This cannot be undone.')) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/datasources/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/datasources');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!dataSource) {
    return null;
  }

  const tables = dataSource.schemaCache?.tables || [];
  const lastRefreshed = dataSource.schemaCache?.lastRefreshed 
    ? new Date(dataSource.schemaCache.lastRefreshed).toLocaleString()
    : 'Never';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/datasources">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{dataSource.name}</h1>
              <p className="text-gray-500">{dataSource.type} • {tables.length} tables</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Sync Schema
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4">Connection Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type:</span>
            <span className="ml-2 font-medium">{dataSource.type}</span>
          </div>
          <div>
            <span className="text-gray-500">Last Synced:</span>
            <span className="ml-2 font-medium">{lastRefreshed}</span>
          </div>
          <div>
            <span className="text-gray-500">ID:</span>
            <span className="ml-2 font-mono text-xs">{dataSource.id}</span>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold mb-4">Tables ({tables.length})</h2>
        {tables.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No tables found. Try syncing the schema.</p>
        ) : (
          <div className="space-y-3">
            {tables.slice(0, 20).map((table) => (
              <div key={table.name} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Table2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-sm">{table.name}</span>
                  <span className="text-xs text-gray-400">({table.columns.length} columns)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {table.columns.slice(0, 8).map((col) => (
                    <span key={col.name} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border">
                      {col.name}
                    </span>
                  ))}
                  {table.columns.length > 8 && (
                    <span className="px-2 py-0.5 text-xs text-gray-400">
                      +{table.columns.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            ))}
            {tables.length > 20 && (
              <p className="text-center text-gray-500 text-sm py-2">
                Showing 20 of {tables.length} tables
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
