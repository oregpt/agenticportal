'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { MultiSelectDropdown } from '@/components/filters/MultiSelectDropdown';
import { FilterPresetManager } from '@/components/filters/FilterPresetManager';
import { Plus, CheckCircle2, XCircle, RefreshCw, Loader2, Database, Table2, Zap, Trash2, AlertTriangle, BarChart3, PlugZap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  tableCount?: number;
}

const DATA_SOURCE_TYPES = [
  { id: 'postgres', name: 'PostgreSQL', icon: Database, description: 'Connect to PostgreSQL databases' },
  { id: 'bigquery', name: 'BigQuery', icon: BarChart3, description: 'Connect to Google BigQuery' },
  { id: 'google_sheets_live', name: 'Google Sheets', icon: Table2, description: 'Query Google Sheets with SQL (via BigQuery)' },
  { id: 'mcp_server', name: 'MCP Server', icon: PlugZap, description: 'Connect external MCP tools as a project data source' },
];

interface McpProviderField {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
}

interface McpProviderOption {
  id: string;
  name: string;
  description: string;
  credentialFields: McpProviderField[];
}

interface DataSource {
  id: string;
  name: string;
  type: string;
  organizationId: string;
  workstreamId?: string | null;
  assignedWorkstreamIds?: string[];
  createdAt: string;
  lastSyncedAt?: string;
  schemaCache?: { tables: { name: string }[] };
}

interface WorkstreamOption {
  id: string;
  name: string;
}

interface SyncingState {
  [id: string]: boolean;
}

interface PostgresForm {
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

interface BigQueryForm {
  name: string;
  projectId: string;
  dataset: string;
  serviceAccountKey: string;
}

interface GoogleSheetsLiveForm {
  name: string;
  spreadsheetId: string;
  sheetName: string;
  hasHeader: boolean;
}

function DataSourcesPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [pendingOAuth, setPendingOAuth] = useState<{
    name: string;
    accessToken: string;
    refreshToken: string;
  } | null>(null);
  const [completeSpreadsheetId, setCompleteSpreadsheetId] = useState('');
  
  const [postgresForm, setPostgresForm] = useState<PostgresForm>({
    name: '',
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
  });
  const [postgresConnectionString, setPostgresConnectionString] = useState('');
  const [bigqueryForm, setBigqueryForm] = useState<BigQueryForm>({
    name: '',
    projectId: '',
    dataset: '',
    serviceAccountKey: '',
  });
  const [sheetsLiveForm, setSheetsLiveForm] = useState<GoogleSheetsLiveForm>({
    name: '',
    spreadsheetId: '',
    sheetName: 'Sheet1',
    hasHeader: true,
  });
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpProviders, setMcpProviders] = useState<McpProviderOption[]>([]);
  const [mcpName, setMcpName] = useState('');
  const [mcpProvider, setMcpProvider] = useState('');
  const [mcpCredentials, setMcpCredentials] = useState<Record<string, string>>({});
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
  const [platformProjectId, setPlatformProjectId] = useState<string | null>(null);
  const [platformCredsConfigured, setPlatformCredsConfigured] = useState<boolean>(false);
  const [syncingState, setSyncingState] = useState<SyncingState>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; dependentViewCount: number } | null>(null);
  const [isLoadingDeleteImpact, setIsLoadingDeleteImpact] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [newDataSourceWorkstreamIds, setNewDataSourceWorkstreamIds] = useState<string[]>([]);
  const [assignmentDialog, setAssignmentDialog] = useState<{ id: string; name: string; workstreamIds: string[] } | null>(null);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const selectedWorkstreamId = searchParams.get('workstreamId') || undefined;
  const selectedSourceTypes = (searchParams.get('sourceTypes') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const availableSourceTypes = DATA_SOURCE_TYPES.filter((type) => type.id !== 'mcp_server' || mcpEnabled);

  useEffect(() => {
    fetchDataSources();
    fetchWorkstreams();
    fetchServiceAccountEmail();
    fetchMcpProviders();
    
    // Handle OAuth callback params
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'connected') {
      toast({ title: 'Success', description: 'Data source connected successfully' });
      router.replace('/datasources', { scroll: false });
    }
    
    if (error) {
      toast({ 
        title: 'Error', 
        description: `Error: ${error}`,
        variant: 'destructive' 
      });
      router.replace('/datasources', { scroll: false });
    }
  }, [searchParams, router, toast]);

  async function fetchDataSources() {
    try {
      const params = new URLSearchParams();
      if (selectedWorkstreamId) {
        params.set('workstreamId', selectedWorkstreamId);
      }
      const query = params.toString();
      const res = await fetch(`/api/datasources${query ? `?${query}` : ''}`);
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

  async function fetchWorkstreams() {
    try {
      const res = await fetch('/api/workstreams');
      if (!res.ok) return;
      const data = await res.json();
      setWorkstreams(
        (data.workstreams || []).map((ws: { id: string; name: string }) => ({ id: ws.id, name: ws.name }))
      );
    } catch (error) {
      console.error('Failed to fetch workstreams:', error);
    }
  }

  async function fetchMcpProviders() {
    try {
      const res = await fetch('/api/datasources/mcp-providers');
      if (!res.ok) return;
      const data = await res.json();
      setMcpEnabled(Boolean(data.enabled));
      const providers = Array.isArray(data.providers) ? data.providers : [];
      setMcpProviders(providers);
      if (providers.length > 0 && !mcpProvider) {
        setMcpProvider(String(providers[0].id || ''));
      }
    } catch (error) {
      console.error('Failed to fetch MCP providers:', error);
      setMcpEnabled(false);
      setMcpProviders([]);
    }
  }

  function updateFilterParam(key: string, value?: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.replace(`/datasources${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  }

  function updateMultiFilterParam(key: string, values: string[]) {
    const next = new URLSearchParams(searchParams.toString());
    if (values.length === 0) {
      next.delete(key);
    } else {
      next.set(key, values.join(','));
    }
    router.replace(`/datasources${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  }

  const applyPreset = (query: string) => {
    router.replace(`/datasources${query ? `?${query}` : ''}`, { scroll: false });
  };

  function openAddDialog() {
    setSelectedType(null);
    setTestResult(null);
    setNewDataSourceWorkstreamIds(selectedWorkstreamId ? [selectedWorkstreamId] : []);
    setMcpName('');
    setMcpCredentials({});
    if (mcpProviders.length > 0) {
      setMcpProvider(String(mcpProviders[0]?.id || ''));
    }
    setIsAddDialogOpen(true);
  }

  function toggleProjectAssignment(workstreamId: string, scope: 'new' | 'existing') {
    if (scope === 'new') {
      setNewDataSourceWorkstreamIds((prev) =>
        prev.includes(workstreamId) ? prev.filter((id) => id !== workstreamId) : [...prev, workstreamId]
      );
      return;
    }
    setAssignmentDialog((prev) => {
      if (!prev) return prev;
      const next = prev.workstreamIds.includes(workstreamId)
        ? prev.workstreamIds.filter((id) => id !== workstreamId)
        : [...prev.workstreamIds, workstreamId];
      return { ...prev, workstreamIds: next };
    });
  }

  async function saveAssignments() {
    if (!assignmentDialog) return;
    setSavingAssignments(true);
    try {
      const res = await fetch(`/api/datasources/${assignmentDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workstreamIds: assignmentDialog.workstreamIds }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save assignments');
      }
      toast({ title: 'Saved', description: 'Project assignments updated.' });
      setAssignmentDialog(null);
      fetchDataSources();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save assignments',
        variant: 'destructive',
      });
    } finally {
      setSavingAssignments(false);
    }
  }

  async function fetchServiceAccountEmail() {
    try {
      const res = await fetch('/api/google-sheets-live/service-account');
      if (res.ok) {
        const data = await res.json();
        if (data.configured) {
          setServiceAccountEmail(data.serviceAccountEmail);
          setPlatformProjectId(data.projectId || null);
          setPlatformCredsConfigured(true);
        } else {
          setServiceAccountEmail(null);
          setPlatformProjectId(null);
          setPlatformCredsConfigured(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch service account:', error);
      setPlatformCredsConfigured(false);
    }
  }

  async function handlePostgresSubmit() {
    if (!postgresForm.name || !postgresForm.host || !postgresForm.database) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in name, host, and database',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: postgresForm.name,
          type: 'postgres',
          workstreamIds: newDataSourceWorkstreamIds,
          config: {
            host: postgresForm.host,
            port: parseInt(postgresForm.port) || 5432,
            database: postgresForm.database,
            username: postgresForm.username,
            password: postgresForm.password,
          },
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Data source created successfully' });
        setIsAddDialogOpen(false);
        setSelectedType(null);
        setPostgresForm({ name: '', host: '', port: '5432', database: '', username: '', password: '' });
        fetchDataSources();
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error || 'Failed to create data source', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create data source', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyPostgresConnectionString() {
    if (!postgresConnectionString.trim()) return;
    try {
      const parsed = new URL(postgresConnectionString.trim());
      if (!parsed.protocol.startsWith('postgres')) {
        throw new Error('Connection string must start with postgres:// or postgresql://');
      }
      setPostgresForm((prev) => ({
        ...prev,
        host: parsed.hostname || prev.host,
        port: parsed.port || prev.port,
        database: parsed.pathname?.replace(/^\//, '') || prev.database,
        username: decodeURIComponent(parsed.username || prev.username),
        password: decodeURIComponent(parsed.password || prev.password),
      }));
      toast({
        title: 'Connection string imported',
        description: 'Review the fields and click Test, then Connect.',
      });
    } catch (error) {
      toast({
        title: 'Invalid connection string',
        description: error instanceof Error ? error.message : 'Please check the format and try again.',
        variant: 'destructive',
      });
    }
  }

  async function handleTestConnection(type: string) {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      let config;
      if (type === 'bigquery') {
        config = {
          projectId: bigqueryForm.projectId,
          dataset: bigqueryForm.dataset,
          serviceAccountKey: bigqueryForm.serviceAccountKey,
        };
      } else if (type === 'postgres') {
        config = {
          host: postgresForm.host,
          port: parseInt(postgresForm.port) || 5432,
          database: postgresForm.database,
          username: postgresForm.username,
          password: postgresForm.password,
        };
      } else if (type === 'mcp_server') {
        config = {
          provider: mcpProvider,
          credentials: mcpCredentials,
        };
      }

      const res = await fetch('/api/datasources/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config }),
      });

      const result = await res.json();
      setTestResult(result);
      
      if (result.success) {
        toast({ title: 'Connection Test Passed', description: result.message });
      } else {
        toast({ title: 'Connection Test Failed', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      setTestResult({ success: false, error: 'Failed to test connection' });
      toast({ title: 'Error', description: 'Failed to test connection', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleBigQuerySubmit() {
    if (!bigqueryForm.name || !bigqueryForm.projectId || !bigqueryForm.dataset || !bigqueryForm.serviceAccountKey) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Validate JSON
    try {
      JSON.parse(bigqueryForm.serviceAccountKey);
    } catch {
      toast({
        title: 'Invalid JSON',
        description: 'Service account key must be valid JSON',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bigqueryForm.name,
          type: 'bigquery',
          workstreamIds: newDataSourceWorkstreamIds,
          config: {
            projectId: bigqueryForm.projectId,
            dataset: bigqueryForm.dataset,
            serviceAccountKey: bigqueryForm.serviceAccountKey,
          },
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'BigQuery connected successfully' });
        setIsAddDialogOpen(false);
        setSelectedType(null);
        setBigqueryForm({ name: '', projectId: '', dataset: '', serviceAccountKey: '' });
        fetchDataSources();
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error || 'Failed to connect BigQuery', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to connect BigQuery', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTestSheetsLive() {
    if (!sheetsLiveForm.spreadsheetId || !sheetsLiveForm.sheetName) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in spreadsheet ID and sheet name',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/google-sheets-live/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: sheetsLiveForm.spreadsheetId,
          sheetName: sheetsLiveForm.sheetName,
          hasHeader: sheetsLiveForm.hasHeader,
        }),
      });

      const result = await res.json();
      setTestResult(result);
      
      if (result.success) {
        toast({ title: 'Connection Test Passed', description: result.message });
      } else {
        toast({ title: 'Connection Test Failed', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      setTestResult({ success: false, error: 'Failed to test connection' });
      toast({ title: 'Error', description: 'Failed to test connection', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSheetsLiveSubmit() {
    if (!sheetsLiveForm.name || !sheetsLiveForm.spreadsheetId || !sheetsLiveForm.sheetName) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in name, spreadsheet ID, and sheet name',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sheetsLiveForm.name,
          type: 'google_sheets_live',
          workstreamIds: newDataSourceWorkstreamIds,
          config: {
            spreadsheetId: sheetsLiveForm.spreadsheetId,
            sheetName: sheetsLiveForm.sheetName,
            hasHeader: sheetsLiveForm.hasHeader,
          },
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Google Sheets connected! You can now query it with SQL.' });
        setIsAddDialogOpen(false);
        setSelectedType(null);
        setSheetsLiveForm({ name: '', spreadsheetId: '', sheetName: 'Sheet1', hasHeader: true });
        setTestResult(null);
        fetchDataSources();
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error || 'Failed to connect Google Sheets', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to connect Google Sheets', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSync(id: string) {
    setSyncingState((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/datasources/${id}/sync`, { method: 'POST' });
      if (res.ok) {
        toast({ title: 'Success', description: 'Schema synced successfully' });
        fetchDataSources();
      } else {
        toast({ title: 'Error', description: 'Failed to sync schema', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to sync schema', variant: 'destructive' });
    } finally {
      setSyncingState((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/datasources/${deleteConfirm.id}`, { method: 'DELETE' });
      if (res.ok) {
        const payload = await res.json();
        const deletedViews = Number(payload?.deletedViews || deleteConfirm.dependentViewCount || 0);
        toast({
          title: 'Deleted',
          description:
            deletedViews > 0
              ? `"${deleteConfirm.name}" and ${deletedViews} associated view${deletedViews === 1 ? '' : 's'} were deleted.`
              : `"${deleteConfirm.name}" has been deleted.`,
        });
        setDeleteConfirm(null);
        fetchDataSources();
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error || 'Failed to delete data source', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete data source', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  }

  async function openDeleteConfirmDialog(dataSource: { id: string; name: string }) {
    setIsLoadingDeleteImpact(true);
    try {
      const res = await fetch(`/api/datasources/${dataSource.id}`);
      if (!res.ok) {
        setDeleteConfirm({ id: dataSource.id, name: dataSource.name, dependentViewCount: 0 });
        return;
      }
      const payload = await res.json();
      setDeleteConfirm({
        id: dataSource.id,
        name: dataSource.name,
        dependentViewCount: Number(payload?.dependentViewCount || 0),
      });
    } catch {
      setDeleteConfirm({ id: dataSource.id, name: dataSource.name, dependentViewCount: 0 });
    } finally {
      setIsLoadingDeleteImpact(false);
    }
  }

  async function handleMcpSubmit() {
    if (!mcpEnabled) {
      toast({
        title: 'MCP disabled',
        description: 'MCP Server sources are disabled for this organization.',
        variant: 'destructive',
      });
      return;
    }
    if (!mcpName.trim() || !mcpProvider) {
      toast({
        title: 'Missing fields',
        description: 'Please provide a source name and provider.',
        variant: 'destructive',
      });
      return;
    }

    const providerMeta = mcpProviders.find((provider) => provider.id === mcpProvider);
    if (!providerMeta) {
      toast({
        title: 'Provider unavailable',
        description: 'Selected MCP provider is not enabled for this organization.',
        variant: 'destructive',
      });
      return;
    }

    const missing = providerMeta.credentialFields
      .filter((field) => field.required)
      .filter((field) => !String(mcpCredentials[field.key] || '').trim())
      .map((field) => field.label);
    if (missing.length > 0) {
      toast({
        title: 'Missing credentials',
        description: `Required fields: ${missing.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mcpName.trim(),
          type: 'mcp_server',
          workstreamIds: newDataSourceWorkstreamIds,
          config: {
            provider: mcpProvider,
            credentials: mcpCredentials,
          },
        }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'MCP data source created successfully' });
        setIsAddDialogOpen(false);
        setSelectedType(null);
        setMcpName('');
        setMcpCredentials({});
        fetchDataSources();
      } else {
        const payload = await res.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: payload.error || 'Failed to create MCP data source',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create MCP data source',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function getTypeIcon(type: string) {
    const typeConfig = DATA_SOURCE_TYPES.find((t) => t.id === type);
    return typeConfig?.icon || Database;
  }

  function renderProjectAssignmentPicker() {
    return (
      <div className="space-y-2">
        <Label>Assign to Projects (optional)</Label>
        <div className="max-h-36 overflow-auto rounded-lg border border-border p-2">
          {workstreams.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">No projects available</p>
          ) : (
            workstreams.map((ws) => (
              <label key={ws.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={newDataSourceWorkstreamIds.includes(ws.id)}
                  onChange={() => toggleProjectAssignment(ws.id, 'new')}
                  className="rounded border-gray-300"
                />
                <span>{ws.name}</span>
              </label>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">You can assign this data source to multiple projects.</p>
      </div>
    );
  }

  const filteredDataSources =
    selectedSourceTypes.length === 0
      ? dataSources
      : dataSources.filter((ds) => selectedSourceTypes.includes(ds.type));


  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 fade-in-up">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md rounded-2xl border-border">
            {!selectedType ? (
              <>
                <DialogHeader>
                  <DialogTitle>Add Data Source</DialogTitle>
                  <DialogDescription>Choose how you want to connect your data</DialogDescription>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  New here? Start with PostgreSQL for the quickest setup.
                </p>
                <div className="grid gap-3 py-4">
                  {availableSourceTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => {
                          setSelectedType(type.id);
                          setTestResult(null);
                          if (type.id === 'mcp_server' && mcpProviders.length > 0) {
                            const firstProvider = String(mcpProviders[0]?.id || '');
                            setMcpProvider(firstProvider);
                            setMcpCredentials({});
                          }
                        }}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
                      >
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{type.name}</div>
                          <div className="text-sm text-muted-foreground">{type.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : selectedType === 'postgres' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Connect PostgreSQL</DialogTitle>
                  <DialogDescription>Paste a connection string or fill in fields manually</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Connection String (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="postgresql://user:password@host:5432/database"
                        value={postgresConnectionString}
                        onChange={(e) => setPostgresConnectionString(e.target.value)}
                      />
                      <Button type="button" variant="outline" onClick={applyPostgresConnectionString}>
                        Import
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      If you have a full connection URL, paste it here to autofill the form.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="My Database"
                      value={postgresForm.name}
                      onChange={(e) => setPostgresForm({ ...postgresForm, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label>Host</Label>
                      <Input
                        placeholder="localhost"
                        value={postgresForm.host}
                        onChange={(e) => setPostgresForm({ ...postgresForm, host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        placeholder="5432"
                        value={postgresForm.port}
                        onChange={(e) => setPostgresForm({ ...postgresForm, port: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Database</Label>
                    <Input
                      placeholder="mydb"
                      value={postgresForm.database}
                      onChange={(e) => setPostgresForm({ ...postgresForm, database: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        placeholder="postgres"
                        value={postgresForm.username}
                        onChange={(e) => setPostgresForm({ ...postgresForm, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                    <Input
                      type="password"
                      value={postgresForm.password}
                      onChange={(e) => setPostgresForm({ ...postgresForm, password: e.target.value })}
                      placeholder="Your database password"
                    />
                  </div>
                  </div>
                  {renderProjectAssignmentPicker()}
                  {testResult && (
                    <Alert variant={testResult.success ? 'default' : 'destructive'} className={testResult.success ? 'border-green-500 bg-green-50' : ''}>
                      <AlertDescription className="flex items-center gap-2">
                        {testResult.success ? (
                          <><CheckCircle2 className="w-4 h-4 text-green-600" /> {testResult.message}</>
                        ) : (
                          <><XCircle className="w-4 h-4" /> {testResult.error}</>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setSelectedType(null); setTestResult(null); }} className="flex-1">
                    Back
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleTestConnection('postgres')} 
                    disabled={isTesting || !postgresForm.host || !postgresForm.database || !postgresForm.username}
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Test</>}
                  </Button>
                  <Button onClick={handlePostgresSubmit} disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                  </Button>
                </div>
              </>
            ) : selectedType === 'bigquery' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Connect BigQuery</DialogTitle>
                  <DialogDescription>Enter your BigQuery project details</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {serviceAccountEmail ? (
                    <Alert className="border-blue-200 bg-blue-50">
                      <AlertDescription className="text-sm">
                        <strong>Platform Service Account:</strong><br />
                        <code className="bg-blue-100 px-2 py-0.5 rounded text-xs mt-1 inline-block">{serviceAccountEmail}</code>
                        {platformProjectId ? (
                          <span className="text-muted-foreground ml-2">Project: {platformProjectId}</span>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : platformCredsConfigured === false ? (
                    <Alert variant="destructive">
                      <AlertDescription className="text-sm">
                        Platform GCP credentials are not configured. Google Sheets Live connectors will fail until this is set.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="My BigQuery Project"
                      value={bigqueryForm.name}
                      onChange={(e) => setBigqueryForm({ ...bigqueryForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project ID</Label>
                    <Input
                      placeholder="my-project-123456"
                      value={bigqueryForm.projectId}
                      onChange={(e) => setBigqueryForm({ ...bigqueryForm, projectId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dataset</Label>
                    <Input
                      placeholder="my_dataset"
                      value={bigqueryForm.dataset}
                      onChange={(e) => setBigqueryForm({ ...bigqueryForm, dataset: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Account Key (JSON)</Label>
                    <Textarea
                      className="h-32 resize-none font-mono"
                      placeholder='{"type": "service_account", ...}'
                      value={bigqueryForm.serviceAccountKey}
                      onChange={(e) => setBigqueryForm({ ...bigqueryForm, serviceAccountKey: e.target.value })}
                    />
                  </div>
                  {renderProjectAssignmentPicker()}
                  {testResult && (
                    <Alert variant={testResult.success ? 'default' : 'destructive'} className={testResult.success ? 'border-green-500 bg-green-50' : ''}>
                      <AlertDescription className="flex items-center gap-2">
                        {testResult.success ? (
                          <><CheckCircle2 className="w-4 h-4 text-green-600" /> {testResult.message}</>
                        ) : (
                          <><XCircle className="w-4 h-4" /> {testResult.error}</>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setSelectedType(null); setTestResult(null); }} className="flex-1">
                    Back
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleTestConnection('bigquery')} 
                    disabled={isTesting || !bigqueryForm.projectId || !bigqueryForm.dataset || !bigqueryForm.serviceAccountKey}
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Test</>}
                  </Button>
                  <Button onClick={handleBigQuerySubmit} disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                  </Button>
                </div>
              </>
            ) : selectedType === 'google_sheets_live' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Connect Google Sheets</DialogTitle>
                  <DialogDescription>Query your Google Sheet with SQL via BigQuery</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {serviceAccountEmail && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <AlertDescription className="text-sm">
                        <strong>Step 1:</strong> Share your Google Sheet with:<br />
                        <code className="bg-blue-100 px-2 py-0.5 rounded text-xs mt-1 inline-block">{serviceAccountEmail}</code>
                        <span className="text-muted-foreground ml-2">(Viewer access)</span>
                        {platformProjectId ? (
                          <span className="text-muted-foreground ml-2">Project: {platformProjectId}</span>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  )}
                  {!serviceAccountEmail && platformCredsConfigured === false ? (
                    <Alert variant="destructive">
                      <AlertDescription className="text-sm">
                        Platform GCP credentials are not configured. Ask an admin to set <code>EDS_GCP_SERVICE_ACCOUNT_KEY_B64</code>.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="My Spreadsheet Data"
                      value={sheetsLiveForm.name}
                      onChange={(e) => setSheetsLiveForm({ ...sheetsLiveForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Spreadsheet ID</Label>
                    <Input
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                      value={sheetsLiveForm.spreadsheetId}
                      onChange={(e) => setSheetsLiveForm({ ...sheetsLiveForm, spreadsheetId: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">From URL: docs.google.com/spreadsheets/d/<span className="font-medium">SPREADSHEET_ID</span>/</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sheet Name</Label>
                    <Input
                      placeholder="Sheet1"
                      value={sheetsLiveForm.sheetName}
                      onChange={(e) => setSheetsLiveForm({ ...sheetsLiveForm, sheetName: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">The tab name in your spreadsheet (default: Sheet1)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hasHeader"
                      checked={sheetsLiveForm.hasHeader}
                      onChange={(e) => setSheetsLiveForm({ ...sheetsLiveForm, hasHeader: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="hasHeader" className="text-sm font-normal">First row contains headers</Label>
                  </div>
                  {renderProjectAssignmentPicker()}
                  {testResult && (
                    <Alert variant={testResult.success ? 'default' : 'destructive'} className={testResult.success ? 'border-green-500 bg-green-50' : ''}>
                      <AlertDescription className="flex items-center gap-2">
                        {testResult.success ? (
                          <><CheckCircle2 className="w-4 h-4 text-green-600" /> {testResult.message}</>
                        ) : (
                          <><XCircle className="w-4 h-4" /> {testResult.error}</>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setSelectedType(null); setTestResult(null); }} className="flex-1">
                    Back
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleTestSheetsLive}
                    disabled={isTesting || !sheetsLiveForm.spreadsheetId || !sheetsLiveForm.sheetName}
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Test</>}
                  </Button>
                  <Button onClick={handleSheetsLiveSubmit} disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                  </Button>
                </div>
              </>
            ) : selectedType === 'mcp_server' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Connect MCP Server</DialogTitle>
                  <DialogDescription>Create a source-backed MCP integration for this project.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {!mcpEnabled ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        MCP Server data sources are disabled for this organization. Ask a platform admin to enable them.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {mcpEnabled && mcpProviders.length === 0 ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        No MCP providers are enabled for this organization.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="Finance MCP Source"
                      value={mcpName}
                      onChange={(e) => setMcpName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={mcpProvider}
                      onChange={(e) => {
                        setMcpProvider(e.target.value);
                        setMcpCredentials({});
                      }}
                    >
                      {mcpProviders.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                    {mcpProviders.find((provider) => provider.id === mcpProvider)?.description ? (
                      <p className="text-xs text-muted-foreground">
                        {mcpProviders.find((provider) => provider.id === mcpProvider)?.description}
                      </p>
                    ) : null}
                  </div>
                  {(mcpProviders.find((provider) => provider.id === mcpProvider)?.credentialFields || []).map((field) => (
                    <div className="space-y-2" key={field.key}>
                      <Label>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </Label>
                      <Input
                        type={field.key.toLowerCase().includes('secret') || field.key.toLowerCase().includes('token') ? 'password' : 'text'}
                        placeholder={field.placeholder || field.label}
                        value={mcpCredentials[field.key] || ''}
                        onChange={(e) =>
                          setMcpCredentials((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                  {renderProjectAssignmentPicker()}
                  {testResult && (
                    <Alert variant={testResult.success ? 'default' : 'destructive'} className={testResult.success ? 'border-green-500 bg-green-50' : ''}>
                      <AlertDescription className="flex items-center gap-2">
                        {testResult.success ? (
                          <><CheckCircle2 className="w-4 h-4 text-green-600" /> {testResult.message}</>
                        ) : (
                          <><XCircle className="w-4 h-4" /> {testResult.error}</>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setSelectedType(null); setTestResult(null); }} className="flex-1">
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleTestConnection('mcp_server')}
                    disabled={isTesting || !mcpEnabled || !mcpProvider}
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Test</>}
                  </Button>
                  <Button onClick={handleMcpSubmit} disabled={isSubmitting || !mcpEnabled} className="flex-1 bg-primary hover:bg-primary/90">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Coming Soon</DialogTitle>
                  <DialogDescription>This connector is not yet available</DialogDescription>
                </DialogHeader>
                <Button variant="outline" onClick={() => setSelectedType(null)}>
                  Back
                </Button>
              </>
            )}
          </DialogContent>
      </Dialog>

      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={(value) => updateFilterParam('workstreamId', value)}
        pageLabel="Data Sources"
        pageDescription="Connect and manage raw data sources for this project scope."
        rightSlot={
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-end">
            <div className="w-full md:w-64">
              <MultiSelectDropdown
                label="Data Source Type"
                options={availableSourceTypes.map((type) => ({ value: type.id, label: type.name }))}
                selectedValues={selectedSourceTypes}
                onChange={(values) => updateMultiFilterParam('sourceTypes', values)}
                emptyLabel="All types"
              />
            </div>
            <FilterPresetManager
              pageKey="datasources"
              currentQuery={searchParams.toString()}
              onApply={applyPreset}
            />
          </div>
        }
      />

      <div className="ui-shell flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Connected Data Sources</p>
          <p className="text-xs text-muted-foreground">Manage the source layer for this project scope.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            {filteredDataSources.length} shown
          </span>
          <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Data Source
          </Button>
        </div>
      </div>

      {/* Data Sources List */}
      {isLoading ? (
        <div className="ui-empty fade-in-up-delay-1">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Loading data sources...</p>
        </div>
      ) : filteredDataSources.length === 0 ? (
        <div className="ui-empty fade-in-up-delay-1">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Database className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No data sources</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Connect your first data source to start querying your data.</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Data Source
              </Button>
              <Button variant="outline" asChild>
                <Link href="/demo">
                  Try Demo Data
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="ui-card overflow-hidden fade-in-up-delay-1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Name</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Tables</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Projects</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDataSources.map((ds) => (
                <tr key={ds.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        {(() => {
                          const TypeIcon = getTypeIcon(ds.type);
                          return <TypeIcon className="h-5 w-5 text-primary" />;
                        })()}
                      </div>
                      <span className="font-medium">{ds.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="secondary" className="capitalize">{ds.type}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Table2 className="w-3.5 h-3.5" />
                      {ds.schemaCache?.tables?.length || 0} tables
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(ds.assignedWorkstreamIds || []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      ) : (
                        (ds.assignedWorkstreamIds || []).slice(0, 2).map((workstreamId) => {
                          const label = workstreams.find((ws) => ws.id === workstreamId)?.name || workstreamId;
                          return (
                            <Badge key={workstreamId} variant="outline" className="max-w-[170px] truncate">
                              {label}
                            </Badge>
                          );
                        })
                      )}
                      {(ds.assignedWorkstreamIds || []).length > 2 ? (
                        <Badge variant="outline">+{(ds.assignedWorkstreamIds || []).length - 2}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {ds.lastSyncedAt ? (
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                        <XCircle className="w-3 h-3 mr-1" />
                        Not synced
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAssignmentDialog({
                            id: ds.id,
                            name: ds.name,
                            workstreamIds: [...(ds.assignedWorkstreamIds || []), ...(ds.workstreamId ? [ds.workstreamId] : [])]
                              .filter((value, index, arr) => arr.indexOf(value) === index),
                          })
                        }
                        className="hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                      >
                        Manage Source
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(ds.id)}
                        disabled={syncingState[ds.id]}
                        className="hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                      >
                        {syncingState[ds.id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Sync
                        </>
                      )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteConfirmDialog({ id: ds.id, name: ds.name })}
                        className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                        disabled={isLoadingDeleteImpact}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!assignmentDialog} onOpenChange={(open) => !open && setAssignmentDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Source Projects</DialogTitle>
            <DialogDescription>
              {assignmentDialog ? `Choose projects for "${assignmentDialog.name}".` : 'Choose projects.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto rounded-lg border border-border p-2">
            {workstreams.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted-foreground">No projects available</p>
            ) : (
              workstreams.map((ws) => (
                <label key={ws.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={assignmentDialog?.workstreamIds.includes(ws.id) || false}
                    onChange={() => toggleProjectAssignment(ws.id, 'existing')}
                    className="rounded border-gray-300"
                  />
                  <span>{ws.name}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setAssignmentDialog(null)} className="flex-1" disabled={savingAssignments}>
              Cancel
            </Button>
            <Button onClick={saveAssignments} className="flex-1 bg-primary hover:bg-primary/90" disabled={savingAssignments}>
              {savingAssignments ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Data Source
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete <strong>&quot;{deleteConfirm?.name}&quot;</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>This action cannot be undone.</strong>{' '}
                {deleteConfirm?.dependentViewCount
                  ? `${deleteConfirm.dependentViewCount} associated view${deleteConfirm.dependentViewCount === 1 ? '' : 's'} will be deleted automatically.`
                  : 'No dependent views were found.'}
              </AlertDescription>
            </Alert>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirm(null)} 
              className="flex-1"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete} 
              disabled={isDeleting} 
              className="flex-1"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Forever'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DataSourcesPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
      <DataSourcesPageContent />
    </Suspense>
  );
}




