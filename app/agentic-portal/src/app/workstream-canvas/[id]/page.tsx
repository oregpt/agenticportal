'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft,
  Plus, 
  Database, 
  Table2, 
  LayoutDashboard,
  FileOutput,
  Sparkles,
  Play,
  Settings,
  Trash2,
  X,
  Zap,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Hexagon,
  FileText,
  Download,
  Mail,
  Webhook,
  Check,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        ${isSelected ? 'ring-2 ring-primary ring-offset-2 rounded-xl' : ''}
      `}
    >
      <div className={`
        relative p-4 rounded-xl border-2 ${config.borderColor} ${config.bgColor} ${config.hoverBorder}
        transition-all min-w-[200px] hover:shadow-md
      `}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.iconBg}`}>
            <Icon className={`w-5 h-5 ${config.textColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 truncate">{node.name}</h4>
              {node.status === 'error' && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              {node.status === 'syncing' && (
                <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
              )}
            </div>
            {node.description && (
              <p className="text-sm text-gray-500 truncate">{node.description}</p>
            )}
          </div>
        </div>

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 rounded-lg bg-white/80 hover:bg-white shadow-sm border border-gray-200">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
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
        group relative p-4 rounded-xl border-2 border-dashed border-gray-300
        hover:border-gray-400 hover:bg-gray-50 transition-all min-w-[200px]
        flex items-center gap-3
      `}
    >
      <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
        <Plus className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" />
      </div>
      <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
        {config.addLabel}
      </span>
    </button>
  );
}

// Connect Source Modal
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
  const [step, setStep] = useState<'type' | 'config'>('type');
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '5432',
    database: '',
    username: 'postgres',
    password: ''
  });

  const sourceTypes = [
    { id: 'postgres', name: 'PostgreSQL', icon: '🐘', desc: 'Connect to PostgreSQL databases' },
    { id: 'bigquery', name: 'BigQuery', icon: '📊', desc: 'Connect to Google BigQuery' },
    { id: 'google_sheets', name: 'Google Sheets', icon: '📗', desc: 'Query Google Sheets with SQL' },
  ];

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
          }
        }),
      });

      if (response.ok) {
        onSuccess();
        onClose();
        setStep('type');
        setSourceType(null);
        setFormData({ name: '', host: '', port: '5432', database: '', username: 'postgres', password: '' });
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Connect Data Source
          </DialogTitle>
          <DialogDescription>
            {step === 'type' ? 'Choose the type of data source to connect' : 'Enter connection details'}
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
              <input
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
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData(f => ({ ...f, host: e.target.value }))}
                  placeholder="localhost"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Port</label>
                <input
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
              <input
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
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(f => ({ ...f, username: e.target.value }))}
                  placeholder="postgres"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('type')}>Back</Button>
              <Button 
                className="flex-1" 
                onClick={handleConnect}
                disabled={isLoading || !formData.name || !formData.host}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Connect
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Create View Modal
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
  const [query, setQuery] = useState('');
  const [selectedDataSource, setSelectedDataSource] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (dataSources.length === 1) {
      setSelectedDataSource(dataSources[0].id);
    }
  }, [dataSources]);

  const handleGenerate = async () => {
    if (!query || !selectedDataSource) return;
    
    setIsGenerating(true);
    try {
      // First generate SQL via AI Chat
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          dataSourceId: selectedDataSource,
        }),
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to generate SQL');
      }

      const chatData = await chatResponse.json();
      
      if (chatData.sql) {
        // Save as view
        const viewResponse = await fetch('/api/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: query.slice(0, 50), // Use query as name
            sql: chatData.sql,
            dataSourceId: selectedDataSource,
            workstreamId,
            naturalLanguageQuery: query,
          }),
        });

        if (viewResponse.ok) {
          onSuccess();
          onClose();
          setQuery('');
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
            Describe what data you want to see in natural language
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {dataSources.length > 1 && (
            <div>
              <label className="text-sm font-medium text-gray-700">Data Source</label>
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Select a data source</option>
                {dataSources.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700">What would you like to see?</label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Show me the top 10 customers by revenue this month..."
              className="mt-1 w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px] resize-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Try:</span>
            {['Recent transactions', 'Failed jobs today', 'User signups by week'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setQuery(suggestion)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {dataSources.length === 1 && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Data Source</p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Database className="w-4 h-4 text-blue-600" />
                {dataSources[0].name}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              className="flex-1 gap-2" 
              disabled={!query || !selectedDataSource || isGenerating}
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
  const [showAIChat, setShowAIChat] = useState(false);
  
  // Modal states
  const [showConnectSource, setShowConnectSource] = useState(false);
  const [showCreateView, setShowCreateView] = useState(false);
  const [showCreateDashboard, setShowCreateDashboard] = useState(false);
  const [showAddOutput, setShowAddOutput] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/workstreams/${workstreamId}`);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!workstream) {
    return null;
  }

  const hasNodes = nodes.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Subtle grid background */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(209 213 219) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Header */}
      <header className="relative border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/workstreams"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${workstream.color}20` }}
              >
                <Hexagon className="w-4 h-4" style={{ color: workstream.color }} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{workstream.name}</h1>
                <p className="text-xs text-gray-500">Visual pipeline canvas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowAIChat(!showAIChat)}
                variant={showAIChat ? "default" : "outline"}
                className={`gap-2 ${showAIChat ? 'bg-gradient-to-r from-violet-600 to-emerald-600 border-0' : ''}`}
              >
                <Sparkles className="w-4 h-4" />
                AI Assistant
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5 text-gray-500" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Main Canvas */}
        <div className="flex-1 overflow-auto p-8">
          {!hasNodes ? (
            <EmptyCanvas onConnectSource={() => setShowConnectSource(true)} />
          ) : (
            <>
              {/* Column Headers */}
              <div className="flex gap-6 mb-4 min-w-max">
                {(['datasource', 'view', 'dashboard', 'output'] as NodeType[]).map((type) => {
                  const config = nodeConfig[type];
                  const Icon = config.icon;
                  return (
                    <div key={type} className="w-[220px]">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 mb-3 px-1">
                        <Icon className={`w-3.5 h-3.5 ${config.textColor}`} />
                        <span className="font-medium">{config.label}s</span>
                        <span className="text-gray-400">({nodesByType[type].length})</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Nodes Grid */}
              <div className="relative min-w-max">
                <div className="flex gap-6">
                  {(['datasource', 'view', 'dashboard', 'output'] as NodeType[]).map((type, colIndex) => (
                    <div key={type} className="w-[220px] space-y-3">
                      {nodesByType[type].map((node) => (
                        <div key={node.id} className="relative">
                          {colIndex < 3 && nodesByType[type].length > 0 && (
                            <div className="absolute left-full top-1/2 w-6 h-0.5 bg-gradient-to-r from-gray-300 to-gray-200" />
                          )}
                          <NodeCard 
                            node={node} 
                            onSelect={setSelectedNode}
                            isSelected={selectedNode?.id === node.id}
                          />
                        </div>
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
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI Chat Sidebar */}
        {showAIChat && (
          <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">AI Assistant</h3>
                    <p className="text-xs text-gray-500">
                      {selectedNode ? selectedNode.name : 'Ask anything'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAIChat(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Quick actions</p>
              <div className="space-y-1.5">
                <button 
                  onClick={() => setShowCreateView(true)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm transition-colors"
                >
                  ✨ Create a view with AI
                </button>
                <button 
                  onClick={() => setShowCreateDashboard(true)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm transition-colors"
                >
                  📊 Build a dashboard
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-auto">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500 flex-shrink-0" />
                <div className="bg-gray-100 rounded-xl rounded-tl-none px-3 py-2 text-sm text-gray-700">
                  Hi! I can help you build your pipeline. Select a node or ask me to create something.
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask AI..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-gray-400"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-primary hover:bg-primary/90 transition-colors">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Node Detail Sidebar */}
        {selectedNode && !showAIChat && (
          <div className="w-72 border-l border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-medium text-sm">{nodeConfig[selectedNode.type].label}</h3>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <p className="font-medium text-sm">{selectedNode.name}</p>
              </div>
              {selectedNode.description && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Description</label>
                  <p className="text-sm text-gray-600">{selectedNode.description}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    selectedNode.status === 'active' ? 'bg-emerald-500' :
                    selectedNode.status === 'error' ? 'bg-red-500' :
                    'bg-amber-500'
                  }`} />
                  <span className="text-sm capitalize">{selectedNode.status || 'active'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                  <Eye className="w-4 h-4" />
                  View Details
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                  <Play className="w-4 h-4" />
                  Run / Refresh
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50" size="sm">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
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
    </div>
  );
}
