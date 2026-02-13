'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Database, MoreHorizontal, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface DataSource {
  id: string;
  name: string;
  type: string;
  organizationId: string;
  organizationName?: string;
  status: 'connected' | 'error' | 'pending';
  lastSyncedAt: string | null;
  createdAt: string;
}

export default function PlatformDataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchDataSources();
  }, []);

  async function fetchDataSources() {
    try {
      const res = await fetch('/api/admin/datasources');
      if (res.ok) {
        const data = await res.json();
        setDataSources(data.dataSources || []);
      }
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredDataSources = dataSources.filter(ds => {
    const matchesSearch = ds.name.toLowerCase().includes(search.toLowerCase()) ||
      ds.organizationName?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || ds.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const typeColors: Record<string, string> = {
    postgres: 'bg-blue-100 text-blue-800 border-blue-200',
    bigquery: 'bg-green-100 text-green-800 border-green-200',
    google_sheets: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    csv: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    connected: <CheckCircle className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
    pending: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">All Data Sources</h1>
        <p className="text-muted-foreground">View data sources across all organizations</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search data sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="postgres">PostgreSQL</SelectItem>
            <SelectItem value="bigquery">BigQuery</SelectItem>
            <SelectItem value="google_sheets">Google Sheets</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources ({filteredDataSources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredDataSources.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No data sources</h3>
              <p className="text-muted-foreground">
                {search || typeFilter !== 'all' 
                  ? 'No data sources match your filters' 
                  : 'Organizations haven\'t connected any data sources yet'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDataSources.map((ds) => (
                  <TableRow key={ds.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        {ds.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColors[ds.type] || typeColors.csv}>
                        {ds.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link 
                        href={`/admin/organizations/${ds.organizationId}`}
                        className="hover:underline"
                      >
                        {ds.organizationName || ds.organizationId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcons[ds.status]}
                        <span className="capitalize">{ds.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ds.lastSyncedAt 
                        ? new Date(ds.lastSyncedAt).toLocaleString() 
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
