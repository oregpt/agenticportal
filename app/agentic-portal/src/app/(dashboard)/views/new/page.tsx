'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Database, Code, MessageSquare, Play, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface DataSource {
  id: string;
  name: string;
  type: string;
  organizationId?: string;
}

// Wrapper with Suspense for useSearchParams
export default function NewViewPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewViewPageContent />
    </Suspense>
  );
}

function NewViewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'chat'; // 'chat' or 'sql'

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dataSourceId, setDataSourceId] = useState('');
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // SQL mode
  const [sql, setSql] = useState('SELECT * FROM ');
  
  // Chat mode
  const [query, setQuery] = useState('');
  const [generatedSql, setGeneratedSql] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Results
  const [results, setResults] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    try {
      const response = await fetch('/api/datasources');
      if (response.ok) {
        const data = await response.json();
        setDataSources(data.dataSources || []);
        if (data.dataSources?.length > 0) {
          setDataSourceId(data.dataSources[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch data sources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSQL = async () => {
    if (!query.trim() || !dataSourceId) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: query }],
          dataSourceId,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.sql) {
          setGeneratedSql(data.sql);
          setSql(data.sql);
        }
      }
    } catch (err) {
      setError('Failed to generate SQL');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunQuery = async () => {
    const queryToRun = mode === 'sql' ? sql : generatedSql;
    if (!queryToRun.trim() || !dataSourceId) return;
    
    setIsRunning(true);
    setError(null);
    setResults(null);
    
    try {
      // Get organizationId from the selected data source
      const selectedDs = dataSources.find(ds => ds.id === dataSourceId);
      const orgId = selectedDs?.organizationId || '';
      
      const response = await fetch(`/api/datasources/${dataSourceId}/query?organizationId=${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: queryToRun }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.result?.rows || data.rows || []);
        setColumns(data.result?.columns?.map((c: any) => c.name || c) || data.columns || []);
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

  const handleSaveView = async () => {
    const finalSql = mode === 'sql' ? sql : generatedSql;
    if (!name.trim() || !finalSql.trim() || !dataSourceId) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          description, 
          dataSourceId, 
          sql: finalSql,
          naturalLanguageQuery: mode === 'chat' ? query : null,
        }),
      });
      
      if (response.ok) {
        router.push('/views');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save view');
      }
    } catch (err) {
      setError('Failed to save view');
    } finally {
      setIsSaving(false);
    }
  };

  const currentSql = mode === 'sql' ? sql : generatedSql;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/views">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create View</h1>
            <p className="text-muted-foreground">Define a reusable query view</p>
          </div>
        </div>
        <Button onClick={handleSaveView} disabled={!name.trim() || !currentSql.trim() || isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save View'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Query Builder */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>View Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>View Name *</Label>
                <Input
                  placeholder="e.g., Monthly Revenue, Active Users"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="What does this view show?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Source *</Label>
                {!isLoading && dataSources.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No data sources found. <Link href="/datasources" className="underline font-medium">Add a data source</Link> first to create views.
                  </div>
                ) : (
                  <Select value={dataSourceId} onValueChange={setDataSourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a data source" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataSources.map((ds) => (
                        <SelectItem key={ds.id} value={ds.id}>
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            {ds.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Query</CardTitle>
              <CardDescription>Write SQL directly or use natural language</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={mode} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Natural Language
                  </TabsTrigger>
                  <TabsTrigger value="sql" className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    SQL
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="chat" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Ask a question</Label>
                    <Textarea
                      placeholder="e.g., Show me total revenue by month for the last year"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={handleGenerateSQL} 
                    disabled={!query.trim() || !dataSourceId || isGenerating}
                  >
                    {isGenerating ? 'Generating...' : 'Generate SQL'}
                  </Button>
                  
                  {generatedSql && (
                    <div className="space-y-2 mt-4">
                      <Label>Generated SQL</Label>
                      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-md text-sm overflow-x-auto">
                        {generatedSql}
                      </pre>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="sql" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>SQL Query</Label>
                    <Textarea
                      placeholder="SELECT * FROM ..."
                      value={sql}
                      onChange={(e) => setSql(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-4 flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleRunQuery}
                  disabled={!currentSql.trim() || !dataSourceId || isRunning}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isRunning ? 'Running...' : 'Run Query'}
                </Button>
                {!dataSourceId && !isLoading && (
                  <span className="text-sm text-muted-foreground">Select a data source to run queries</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <Card>
          <CardHeader>
            <CardTitle>Query Results</CardTitle>
            <CardDescription>
              {results ? `${results.length} rows returned` : 'Run the query to see results'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                {error}
              </div>
            )}
            
            {results && results.length > 0 ? (
              <div className="border rounded-md overflow-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 sticky top-0">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="px-4 py-2 text-left font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 100).map((row, i) => (
                      <tr key={i} className="border-t">
                        {columns.map((col) => (
                          <td key={col} className="px-4 py-2">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : results && results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Query returned no results
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Code className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Write a query and click Run to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
