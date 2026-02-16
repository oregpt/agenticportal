'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Plus, 
  Minus,
  Database, 
  Table2, 
  LayoutDashboard,
  FileOutput,
  Sparkles,
  X,
  MoreHorizontal,
  RefreshCw,
  FileText,
  Mail,
  Webhook,
  Check,
  Loader2,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Node types
type NodeType = 'datasource' | 'view' | 'dashboard' | 'output';

interface PipelineNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  parentIds: string[];
  status?: string;
  metadata?: Record<string, unknown>;
}

interface Workstream {
  id: string;
  name: string;
  description?: string;
  color: string;
}

const nodeConfig = {
  datasource: {
    icon: Database,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverBorder: 'hover:border-blue-400',
    iconBg: 'bg-blue-100',
    textColor: 'text-blue-600',
    label: 'Data Source',
    addLabel: 'Connect Source'
  },
  view: {
    icon: Table2,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-400',
    iconBg: 'bg-emerald-100',
    textColor: 'text-emerald-600',
    label: 'View',
    addLabel: 'Create View'
  },
  dashboard: {
    icon: LayoutDashboard,
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    hoverBorder: 'hover:border-violet-400',
    iconBg: 'bg-violet-100',
    textColor: 'text-violet-600',
    label: 'Dashboard',
    addLabel: 'Create Dashboard'
  },
  output: {
    icon: FileOutput,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    hoverBorder: 'hover:border-amber-400',
    iconBg: 'bg-amber-100',
    textColor: 'text-amber-600',
    label: 'Output',
    addLabel: 'Add Output'
  }
};

const sectionOrder: NodeType[] = ['dashboard', 'output', 'view', 'datasource'];

function getEntityUrl(node: PipelineNode): string {
  switch (node.type) {
    case 'datasource':
      return `/datasources/${node.id}`;
    case 'view':
      return `/views/${node.id}`;
    case 'dashboard':
      return `/dashboards/${node.id}`;
    case 'output':
      return `/outputs/${node.id}`;
    default:
      return '/workstreams';
  }
}

function NodeCard({ node, onSelect, isSelected }: { 
  node: PipelineNode; 
  onSelect: (node: PipelineNode) => void;
  isSelected: boolean;
}) {
  const config = nodeConfig[node.type];
  const Icon = config.icon;

  return (
    <div
      onClick={() => onSelect(node)}
      className={`
        group relative cursor-pointer transition-all
        ${isSelected ? 'ring-2 ring-primary ring-offset-1 rounded-lg' : ''}
      `}
    >
      <div className={`
        relative p-2 rounded-lg border ${config.borderColor} ${config.bgColor} ${config.hoverBorder}
        transition-all w-full hover:shadow-md hover:-translate-y-0.5
      `}>
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${config.iconBg}`}>
            <Icon className={`w-3.5 h-3.5 ${config.textColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-medium text-gray-900 truncate">{node.name}</h4>
              {node.status === 'error' && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              {node.status === 'syncing' && (
                <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
              )}
            </div>
          </div>
        </div>

        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1 rounded-md bg-white/80 hover:bg-white shadow-sm border border-gray-200">
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddNodeButton({ type, onClick }: { type: NodeType; onClick: () => void }) {
  const config = nodeConfig[type];

  return (
    <button
      onClick={onClick}
      className={`
        group relative p-2 rounded-lg border border-dashed border-gray-300
        hover:border-primary/40 hover:bg-white/80 transition-all w-full hover:-translate-y-0.5
        flex items-center gap-2
      `}
    >
      <div className="p-1.5 rounded-md bg-gray-100 group-hover:bg-gray-200 transition-colors">
        <Plus className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-700 transition-colors" />
      </div>
      <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
        {config.addLabel}
      </span>
    </button>
  );
}

// Connect Source Modal
interface AvailableTable {
  name: string;
  columns: { name: string; type: string; nullable: boolean }[];
}

function ConnectSourceModal({ 
  open, 
  onClose, 
  workstreamId,
  onSuccess 
}: { 
  open: boolean; 
  onClose: () => void;
  workstreamId: string;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'type' | 'config' | 'tables'>('type');
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '5432',
    database: '',
    username: 'postgres',
    password: ''
  });
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [tableSearch, setTableSearch] = useState('');

  const sourceTypes = [
    { id: 'postgres', name: 'PostgreSQL', icon: 'ðŸ˜', desc: 'Connect to PostgreSQL databases' },
    { id: 'bigquery', name: 'BigQuery', icon: 'ðŸ“Š', desc: 'Connect to Google BigQuery' },
    { id: 'google_sheets', name: 'Google Sheets', icon: 'ðŸ“—', desc: 'Query Google Sheets with SQL' },
  ];

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setStep('type');
      setSourceType(null);
      setFormData({ name: '', host: '', port: '5432', database: '', username: 'postgres', password: '' });
      setAvailableTables([]);
      setSelectedTables(new Set());
      setTableSearch('');
    }
  }, [open]);

  const handleTestAndFetchTables = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/datasources/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: sourceType,
          config: {
            host: formData.host,
            port: parseInt(formData.port),
            database: formData.database,
            username: formData.username,
            password: formData.password,
            fetchTables: true,
          }
        }),
      });

      const result = await response.json();
      
      if (result.success && result.tables) {
        setAvailableTables(result.tables);
        // Pre-select all tables by default
        setSelectedTables(new Set(result.tables.map((t: AvailableTable) => t.name)));
        setStep('tables');
      } else {
        alert(result.error || 'Failed to connect');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          type: sourceType,
          workstreamId,
          config: {
            host: formData.host,
            port: parseInt(formData.port),
            database: formData.database,
            username: formData.username,
            password: formData.password,
            selectedTables: Array.from(selectedTables),
          }
        }),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to connect');
      }
    } catch (error) {
      console.error('Error connecting:', error);
      alert('Failed to connect');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedTables(newSelected);
  };

  const selectAll = () => setSelectedTables(new Set(availableTables.map(t => t.name)));
  const selectNone = () => setSelectedTables(new Set());

  const filteredTables = availableTables.filter(t => 
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={step === 'tables' ? 'sm:max-w-2xl' : 'sm:max-w-lg'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Connect Data Source
          </DialogTitle>
          <DialogDescription>
            {step === 'type' && 'Choose the type of data source to connect'}
            {step === 'config' && 'Enter connection details'}
            {step === 'tables' && 'Select which tables to include'}
          </DialogDescription>
        </DialogHeader>

        {step === 'type' && (
          <div className="grid gap-3 py-4">
            {sourceTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setSourceType(type.id);
                  setStep('config');
                }}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
              >
                <span className="text-2xl">{type.icon}</span>
                <div>
                  <p className="font-medium">{type.name}</p>
                  <p className="text-sm text-gray-500">{type.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 'config' && sourceType === 'postgres' && (
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Display Name</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="My Database"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Host</label>
                <Input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData(f => ({ ...f, host: e.target.value }))}
                  placeholder="localhost"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Port</label>
                <Input
                  type="text"
                  value={formData.port}
                  onChange={(e) => setFormData(f => ({ ...f, port: e.target.value }))}
                  placeholder="5432"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Database</label>
              <Input
                type="text"
                value={formData.database}
                onChange={(e) => setFormData(f => ({ ...f, database: e.target.value }))}
                placeholder="mydb"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Username</label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(f => ({ ...f, username: e.target.value }))}
                  placeholder="postgres"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('type')}>Back</Button>
              <Button 
                className="flex-1" 
                onClick={handleTestAndFetchTables}
                disabled={isTesting || !formData.name || !formData.host}
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Test & Select Tables
              </Button>
            </div>
          </div>
        )}

        {step === 'tables' && (
          <div className="space-y-4 py-4">
            {/* Connection success indicator */}
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Check className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-emerald-700">
                Connected! Found {availableTables.length} tables.
              </span>
            </div>

            {/* Search and bulk actions */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search tables..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="outline" size="sm" onClick={selectNone}>Clear</Button>
            </div>

            {/* Table list */}
            <div className="border rounded-lg max-h-80 overflow-y-auto">
              {filteredTables.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">No tables match your search</p>
              ) : (
                filteredTables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => toggleTable(table.name)}
                    className={`w-full flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors text-left ${
                      selectedTables.has(table.name) ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedTables.has(table.name) 
                        ? 'bg-emerald-500 border-emerald-500' 
                        : 'border-gray-300'
                    }`}>
                      {selectedTables.has(table.name) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <Table2 className="w-4 h-4 text-emerald-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{table.name}</p>
                      <p className="text-xs text-gray-500">{table.columns.length} columns</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Selection summary */}
            <p className="text-sm text-gray-600">
              {selectedTables.size} of {availableTables.length} tables selected
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('config')}>Back</Button>
              <Button 
                className="flex-1" 
                onClick={handleConnect}
                disabled={isLoading || selectedTables.size === 0}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Connect with {selectedTables.size} Tables
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Create View Modal - with table selection
interface TableInfo {
  name: string;
  columns: { name: string; type: string }[];
}

function CreateViewModal({ 
  open, 
  onClose,
  workstreamId,
  dataSources,
  onSuccess
}: { 
  open: boolean; 
  onClose: () => void;
  workstreamId: string;
  dataSources: PipelineNode[];
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'table' | 'query'>('table');
  const [query, setQuery] = useState('');
  const [viewName, setViewName] = useState('');
  const [selectedDataSource, setSelectedDataSource] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Auto-select data source if only one
  useEffect(() => {
    if (dataSources.length === 1) {
      setSelectedDataSource(dataSources[0].id);
    }
  }, [dataSources]);

  // Load tables when data source is selected
  useEffect(() => {
    if (!selectedDataSource) {
      setTables([]);
      return;
    }
    
    const ds = dataSources.find(d => d.id === selectedDataSource);
    if (ds?.metadata) {
      const metadata = ds.metadata as { schemaCache?: { tables?: TableInfo[] } };
      if (metadata.schemaCache?.tables) {
        setTables(metadata.schemaCache.tables);
      }
    }
  }, [selectedDataSource, dataSources]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep('table');
      setQuery('');
      setViewName('');
      setSelectedTable('');
      setTableSearch('');
    }
  }, [open]);

  useEffect(() => {
    if (!selectedTable) {
      setViewName('');
      return;
    }
    setViewName((prev) => (prev.trim() ? prev : `${selectedTable} View`));
  }, [selectedTable]);

  const selectedTableInfo = tables.find(t => t.name === selectedTable);
  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const handleGenerate = async () => {
    if (!query || !viewName.trim() || !selectedDataSource || !selectedTable) return;
    
    setIsGenerating(true);
    try {
      // Generate SQL via AI Chat, scoped to the selected table
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          dataSourceId: selectedDataSource,
          tableName: selectedTable, // Pass the selected table
        }),
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to generate SQL');
      }

      const chatData = await chatResponse.json();
      
      if (chatData.sql) {
        // Save as view with table reference
        const viewResponse = await fetch('/api/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: viewName.trim(),
            sql: chatData.sql,
            dataSourceId: selectedDataSource,
            workstreamId,
            naturalLanguageQuery: query,
            sourceTable: selectedTable, // Store the source table
          }),
        });

        if (viewResponse.ok) {
          onSuccess();
          onClose();
          setQuery('');
          setViewName('');
          setSelectedTable('');
          setStep('table');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate view');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            Create View with AI
          </DialogTitle>
          <DialogDescription>
            {step === 'table' 
              ? 'Select a table to create a view from'
              : `Creating view from ${selectedTable}`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'table' ? (
          <div className="space-y-4 py-4">
            {/* Data Source Selection (if multiple) */}
            {dataSources.length > 1 && (
              <div>
                <label className="text-sm font-medium text-gray-700">Data Source</label>
                <Select
                  value={selectedDataSource || undefined}
                  onValueChange={(value) => {
                    setSelectedDataSource(value);
                    setSelectedTable('');
                  }}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Select a data source" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSources.map((ds) => (
                      <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Single data source display */}
            {dataSources.length === 1 && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <Database className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{dataSources[0].name}</span>
              </div>
            )}

            {/* Table Search */}
            {selectedDataSource && tables.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700">Search Tables</label>
                <Input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Type to filter tables..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            )}

            {/* Table List */}
            {selectedDataSource && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Select Table ({filteredTables.length} of {tables.length})
                </label>
                <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredTables.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      {tables.length === 0 ? 'No tables found' : 'No matching tables'}
                    </div>
                  ) : (
                    filteredTables.slice(0, 50).map((table) => (
                      <button
                        key={table.name}
                        onClick={() => setSelectedTable(table.name)}
                        className={`w-full text-left p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${
                          selectedTable === table.name ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Table2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{table.name}</span>
                          <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                            {table.columns.length} cols
                          </span>
                        </div>
                        {selectedTable === table.name && table.columns.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {table.columns.slice(0, 6).map((col) => (
                              <span key={col.name} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border">
                                {col.name}
                              </span>
                            ))}
                            {table.columns.length > 6 && (
                              <span className="px-2 py-0.5 text-xs text-gray-400">
                                +{table.columns.length - 6} more
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                  {filteredTables.length > 50 && (
                    <div className="p-2 text-center text-gray-500 text-xs bg-gray-50">
                      Showing 50 of {filteredTables.length} tables. Use search to filter.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button 
                className="flex-1" 
                disabled={!selectedTable}
                onClick={() => setStep('query')}
              >
                Continue with {selectedTable ? `"${selectedTable}"` : 'selected table'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Selected table info */}
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-sm">{selectedTable}</span>
                </div>
                <button 
                  onClick={() => setStep('table')}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  Change table
                </button>
              </div>
              {selectedTableInfo && selectedTableInfo.columns.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedTableInfo.columns.slice(0, 8).map((col) => (
                    <span key={col.name} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border">
                      {col.name}
                    </span>
                  ))}
                  {selectedTableInfo.columns.length > 8 && (
                    <span className="px-2 py-0.5 text-xs text-gray-400">
                      +{selectedTableInfo.columns.length - 8} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Query input */}
            <div>
              <label className="text-sm font-medium text-gray-700">View Name</label>
              <Input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g., Orders Last 30 Days"
                className="mt-1"
                maxLength={60}
              />
            </div>

            {/* Query input */}
            <div>
              <label className="text-sm font-medium text-gray-700">What would you like to see from this table?</label>
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`e.g., Show all records from the last 7 days, sorted by date...`}
                className="mt-1 w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px] resize-none"
                autoFocus
              />
            </div>

            {/* Quick suggestions based on table */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-500">Try:</span>
              {[
                'Show all records',
                'Filter by date',
                'Group and count',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('table')}>Back</Button>
              <Button 
                className="flex-1 gap-2" 
                disabled={!query || !viewName.trim() || isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isGenerating ? 'Generating...' : 'Generate View'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Create Dashboard Modal
function CreateDashboardModal({ 
  open, 
  onClose,
  workstreamId,
  views,
  onSuccess
}: { 
  open: boolean; 
  onClose: () => void;
  workstreamId: string;
  views: PipelineNode[];
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          workstreamId,
        }),
      });

      if (response.ok) {
        onSuccess();
        onClose();
        setName('');
        setDescription('');
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to create dashboard');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create dashboard');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-violet-600" />
            Create Dashboard
          </DialogTitle>
          <DialogDescription>
            Create a dashboard shell. You can add or remove widgets anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Dashboard Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekly Metrics Dashboard"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should this dashboard monitor?"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Available Sources</label>
            {views.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                No views yet. Create a view first.
              </p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2">
                  These Views can be used when adding widgets after dashboard creation.
                </p>
                {views.map(view => (
                  <div
                    key={view.id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <Table2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium">{view.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              className="flex-1 gap-2" 
              disabled={!name.trim() || isCreating}
              onClick={handleCreate}
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LayoutDashboard className="w-4 h-4" />
              )}
              {isCreating ? 'Creating...' : 'Create Dashboard'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add Output Modal
function AddOutputModal({ 
  open, 
  onClose,
  workstreamId,
  dashboards,
  onSuccess
}: { 
  open: boolean; 
  onClose: () => void;
  workstreamId: string;
  dashboards: PipelineNode[];
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'type' | 'config'>('type');
  const [outputType, setOutputType] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState('');
  const [schedule, setSchedule] = useState('on_demand');
  const [email, setEmail] = useState('');
  const [contentMode, setContentMode] = useState<'full_dashboard' | 'top_widgets' | 'custom_summary'>('full_dashboard');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (dashboards.length === 1) {
      setSelectedDashboard(dashboards[0].id);
    }
  }, [dashboards]);

  const outputTypes = [
    { id: 'pdf', name: 'PDF Export', icon: FileText, desc: 'Generate PDF reports on schedule' },
    { id: 'email', name: 'Email Report', icon: Mail, desc: 'Send reports via email' },
    { id: 'webhook', name: 'Webhook', icon: Webhook, desc: 'Push data to external systems' },
  ];

  const handleCreate = async () => {
    if (!name || !selectedDashboard || !outputType) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: outputType,
          workstreamId,
          dashboardId: selectedDashboard,
          config: {
            schedule,
            email: outputType === 'email' ? email : undefined,
            contentMode,
            customPrompt: contentMode === 'custom_summary' ? customPrompt : undefined,
          },
        }),
      });

      if (response.ok) {
        onSuccess();
        onClose();
        setStep('type');
        setOutputType(null);
        setName('');
        setSelectedDashboard('');
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to create output');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create output');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileOutput className="w-5 h-5 text-amber-600" />
            Add Output
          </DialogTitle>
          <DialogDescription>
            {step === 'type' ? 'Choose how to export your data' : 'Configure the output'}
          </DialogDescription>
        </DialogHeader>

        {step === 'type' && (
          <div className="grid gap-3 py-4">
            {outputTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => {
                    setOutputType(type.id);
                    setStep('config');
                  }}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left"
                >
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Icon className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">{type.name}</p>
                    <p className="text-sm text-gray-500">{type.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 'config' && (
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Output Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Weekly Report Email"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Dashboard</label>
              {dashboards.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                  No dashboards available. Create a dashboard first.
                </p>
              ) : (
                <Select
                  value={selectedDashboard || undefined}
                  onValueChange={setSelectedDashboard}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a dashboard" />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboards.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Schedule</label>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_demand">On-demand</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Content</label>
              <Select
                value={contentMode}
                onValueChange={(value) => setContentMode(value as 'full_dashboard' | 'top_widgets' | 'custom_summary')}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_dashboard">Full dashboard snapshot</SelectItem>
                  <SelectItem value="top_widgets">Top widgets summary</SelectItem>
                  <SelectItem value="custom_summary">Custom AI summary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {contentMode === 'custom_summary' ? (
              <div>
                <label className="text-sm font-medium text-gray-700">Summary Prompt</label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Summarize weekly changes and call out anomalies."
                  className="mt-1 min-h-[80px]"
                />
              </div>
            ) : null}

            {outputType === 'email' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="team@company.com"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('type')}>Back</Button>
              <Button 
                className="flex-1" 
                onClick={handleCreate}
                disabled={isCreating || !name || !selectedDashboard || (contentMode === 'custom_summary' && !customPrompt.trim())}
              >
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Output
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Empty state component
function EmptyCanvas({ onConnectSource }: { onConnectSource: () => void }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Database className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium mb-2">No data sources yet</h3>
        <p className="text-gray-500 mb-6">
          Start by connecting a data source. Then you can create views, build dashboards, and set up outputs.
        </p>
        <Button onClick={onConnectSource} className="gap-2">
          <Plus className="w-4 h-4" />
          Connect Data Source
        </Button>
      </div>
    </div>
  );
}

export default function WorkstreamCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const workstreamId = params.id as string;

  const [workstream, setWorkstream] = useState<Workstream | null>(null);
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<PipelineNode | null>(null);
  const [activeEntityUrl, setActiveEntityUrl] = useState<string | null>(null);
  const [canvasCollapsed, setCanvasCollapsed] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(260);
  const [sectionOpen, setSectionOpen] = useState<Record<NodeType, boolean>>({
    datasource: false,
    view: false,
    dashboard: false,
    output: false,
  });
  
  // Modal states
  const [showConnectSource, setShowConnectSource] = useState(false);
  const [showCreateView, setShowCreateView] = useState(false);
  const [showCreateDashboard, setShowCreateDashboard] = useState(false);
  const [showAddOutput, setShowAddOutput] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/workstreams/${workstreamId}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setWorkstream(data.workstream);
        setNodes(data.nodes || []);
      } else if (response.status === 404) {
        router.push('/workstreams');
      }
    } catch (error) {
      console.error('Error fetching workstream:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workstreamId]);

  const nodesByType = {
    datasource: nodes.filter(n => n.type === 'datasource'),
    view: nodes.filter(n => n.type === 'view'),
    dashboard: nodes.filter(n => n.type === 'dashboard'),
    output: nodes.filter(n => n.type === 'output')
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workstream) {
    return null;
  }

  const hasNodes = nodes.length > 0;
  const areAllSectionsOpen = sectionOrder.every((type) => sectionOpen[type]);
  const effectiveCanvasWidth = areAllSectionsOpen ? canvasWidth : Math.min(canvasWidth, 210);

  const openNodeInPane = (node: PipelineNode) => {
    setSelectedNode(node);
    const url = new URL(getEntityUrl(node), window.location.origin);
    url.searchParams.set('embed', '1');
    setActiveEntityUrl(`${url.pathname}${url.search}`);
    setCanvasCollapsed(false);
  };

  return (
    <div className="h-full bg-background fade-in-up">
      {/* Subtle grid background */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-35"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)`,
          backgroundSize: '22px 22px'
        }}
      />

      <div className="flex h-full">
        {!canvasCollapsed ? (
          <div className="border-r border-border bg-white/60 backdrop-blur-sm" style={{ width: effectiveCanvasWidth }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <p className="text-xs uppercase tracking-wider text-gray-500">Canvas</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCanvasWidth((w) => Math.max(210, w - 40))}
                  className="p-1.5 rounded-md hover:bg-gray-100"
                  aria-label="Narrow canvas"
                >
                  <Minus className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() => setCanvasWidth((w) => Math.min(620, w + 40))}
                  className="p-1.5 rounded-md hover:bg-gray-100"
                  aria-label="Widen canvas"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() => setCanvasCollapsed(true)}
                  className="p-1.5 rounded-md hover:bg-gray-100"
                  aria-label="Collapse canvas"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() => router.push('/workstreams')}
                  className="p-1.5 rounded-md hover:bg-gray-100"
                  aria-label="Exit canvas mode"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() =>
                    setSectionOpen({
                      datasource: !areAllSectionsOpen,
                      view: !areAllSectionsOpen,
                      dashboard: !areAllSectionsOpen,
                      output: !areAllSectionsOpen,
                    })
                  }
                  className="px-2.5 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-100 text-gray-600"
                >
                  {areAllSectionsOpen ? 'Collapse all' : 'Show all'}
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-41px)] overflow-auto p-4">
              {!hasNodes ? (
                <EmptyCanvas onConnectSource={() => setShowConnectSource(true)} />
              ) : (
                <div className="space-y-5">
                  {sectionOrder.map((type) => {
                    const config = nodeConfig[type];
                    const Icon = config.icon;
                    const isOpen = sectionOpen[type];
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-gray-500 px-1">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-3.5 h-3.5 ${config.textColor}`} />
                            <span className="font-medium">{config.label}s</span>
                            <span className="text-gray-400">({nodesByType[type].length})</span>
                          </div>
                          <button
                            onClick={() => setSectionOpen((prev) => ({ ...prev, [type]: !prev[type] }))}
                            className="px-2 py-0.5 rounded-md border border-gray-200 text-[10px] hover:bg-gray-100"
                          >
                            {isOpen ? 'Hide' : 'Open'}
                          </button>
                        </div>
                        {isOpen ? (
                          <div className="space-y-1.5">
                            {nodesByType[type].map((node) => (
                              <NodeCard
                                key={node.id}
                                node={node}
                                onSelect={openNodeInPane}
                                isSelected={selectedNode?.id === node.id}
                              />
                            ))}
                            <AddNodeButton
                              type={type}
                              onClick={() => {
                                if (type === 'datasource') setShowConnectSource(true);
                                else if (type === 'view') setShowCreateView(true);
                                else if (type === 'dashboard') setShowCreateDashboard(true);
                                else if (type === 'output') setShowAddOutput(true);
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-11 border-r border-border bg-white/60 flex flex-col items-center py-2 gap-2">
            <button
              onClick={() => setCanvasCollapsed(false)}
              className="p-1.5 rounded-md hover:bg-gray-100"
              aria-label="Expand canvas"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600 rotate-180" />
            </button>
            <span className="text-[10px] text-gray-500 [writing-mode:vertical-rl] rotate-180 tracking-widest">CANVAS</span>
          </div>
        )}

        <div className="flex-1 bg-white/70">
          <div className="h-full bg-gray-50">
            {activeEntityUrl ? (
              <iframe
                key={activeEntityUrl}
                src={activeEntityUrl}
                title="Canvas content"
                className="w-full h-full border-0 bg-white"
              />
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="max-w-lg text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Browse from relationships</h3>
                  <p className="text-sm text-gray-600">
                    Click any data source, view, dashboard, or output in the canvas. It will open here so users can browse without leaving this page.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConnectSourceModal 
        open={showConnectSource} 
        onClose={() => setShowConnectSource(false)} 
        workstreamId={workstreamId}
        onSuccess={fetchData}
      />
      <CreateViewModal 
        open={showCreateView} 
        onClose={() => setShowCreateView(false)} 
        workstreamId={workstreamId}
        dataSources={nodesByType.datasource}
        onSuccess={fetchData}
      />
      <CreateDashboardModal 
        open={showCreateDashboard} 
        onClose={() => setShowCreateDashboard(false)} 
        workstreamId={workstreamId}
        views={nodesByType.view}
        onSuccess={fetchData}
      />
      <AddOutputModal 
        open={showAddOutput} 
        onClose={() => setShowAddOutput(false)} 
        workstreamId={workstreamId}
        dashboards={nodesByType.dashboard}
        onSuccess={fetchData}
      />
    </div>
  );
}


