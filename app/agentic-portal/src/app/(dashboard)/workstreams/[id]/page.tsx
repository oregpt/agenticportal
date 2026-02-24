'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Database,
  Table2,
  LayoutDashboard,
  FileOutput,
  Play,
  Settings,
  Trash2,
  ChevronRight,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Loader2,
} from 'lucide-react';

type NodeType = 'datasource' | 'view' | 'dashboard' | 'output';

interface PipelineNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  parentIds: string[];
  status?: 'active' | 'syncing' | 'error';
  metadata?: Record<string, unknown>;
}

interface Workstream {
  id: string;
  name: string;
  description?: string | null;
}

const nodeConfig = {
  datasource: {
    icon: Database,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    label: 'Data Source',
    addLabel: 'Connect Source',
  },
  view: {
    icon: Table2,
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    label: 'View',
    addLabel: 'Create View',
  },
  dashboard: {
    icon: LayoutDashboard,
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    textColor: 'text-violet-400',
    label: 'Dashboard',
    addLabel: 'Create Dashboard',
  },
  output: {
    icon: FileOutput,
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    label: 'Output',
    addLabel: 'Add Output',
  },
};

function NodeCard({
  node,
  onSelect,
  isSelected,
}: {
  node: PipelineNode;
  onSelect: (node: PipelineNode) => void;
  isSelected: boolean;
}) {
  const config = nodeConfig[node.type];
  const Icon = config.icon;

  return (
    <div onClick={() => onSelect(node)} className={`group relative cursor-pointer ${isSelected ? 'ring-2 ring-white/50 rounded-xl' : ''}`}>
      <div className={`absolute inset-0 ${config.bgColor} rounded-xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity`} />
      <div className={`relative p-4 rounded-xl border ${config.borderColor} ${config.bgColor} hover:border-opacity-60 transition-all min-w-[200px]`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-5 h-5 ${config.textColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">{node.name}</h4>
              {node.status === 'error' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              {node.status === 'syncing' && <RefreshCw className="w-3 h-3 text-zinc-400 animate-spin" />}
            </div>
            {node.description && <p className="text-sm text-zinc-500 truncate">{node.description}</p>}
          </div>
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700">
            <MoreHorizontal className="w-4 h-4 text-zinc-400" />
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
      className="group relative p-4 rounded-xl border-2 border-dashed border-zinc-800 hover:border-zinc-600 transition-all min-w-[200px] flex items-center gap-3"
    >
      <div className="p-2 rounded-lg bg-zinc-800 transition-colors">
        <Plus className="w-5 h-5 text-zinc-500 transition-colors" />
      </div>
      <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">{config.addLabel}</span>
    </button>
  );
}

function getNodeDetailHref(node: PipelineNode): string {
  if (node.type === 'dashboard' || node.type === 'view') return `/artifacts/${node.id}`;
  if (node.type === 'datasource') return '/datasources';
  return '/outputs';
}

export default function WorkstreamCanvasPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workstreamId = String(params?.id || '');

  const [workstream, setWorkstream] = useState<Workstream | null>(null);
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<PipelineNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workstreamId) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workstreams/${workstreamId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load project canvas');
        if (!cancelled) {
          setWorkstream(data.workstream || null);
          setNodes(data.nodes || []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project canvas');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [workstreamId]);

  useEffect(() => {
    if (selectedNode && !nodes.some((node) => node.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [nodes, selectedNode]);

  const nodesByType = useMemo(
    () => ({
      datasource: nodes.filter((n) => n.type === 'datasource'),
      view: nodes.filter((n) => n.type === 'view'),
      dashboard: nodes.filter((n) => n.type === 'dashboard'),
      output: nodes.filter((n) => n.type === 'output'),
    }),
    [nodes]
  );

  const handleAddNode = (type: NodeType) => {
    if (type === 'datasource') {
      router.push(`/datasources?workstreamId=${encodeURIComponent(workstreamId)}`);
      return;
    }
    if (type === 'view') {
      router.push(`/project-agent/chat?projectId=${encodeURIComponent(workstreamId)}`);
      return;
    }
    if (type === 'dashboard') {
      router.push(`/artifacts?projectId=${encodeURIComponent(workstreamId)}&type=dashboard`);
      return;
    }
    router.push(`/outputs?workstreamId=${encodeURIComponent(workstreamId)}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      <header className="relative border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/workstreams" className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-medium">{workstream?.name || 'Project Canvas'}</h1>
                <p className="text-sm text-zinc-500">{workstream?.description || 'Visual project flow from source to output'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="flex-1 overflow-auto p-8">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-zinc-400">
              <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Loading project canvas...
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-300">{error}</div>
          ) : (
            <>
              <div className="flex gap-8 mb-6">
                {(['datasource', 'view', 'dashboard', 'output'] as NodeType[]).map((type) => {
                  const config = nodeConfig[type];
                  const Icon = config.icon;
                  return (
                    <div key={type} className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4 px-2">
                        <Icon className={`w-4 h-4 ${config.textColor}`} />
                        <span className={config.textColor}>{config.label}s</span>
                        <span className="text-zinc-600">({nodesByType[type].length})</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="relative">
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  <defs>
                    <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.5" />
                    </linearGradient>
                    <linearGradient id="lineGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.5" />
                    </linearGradient>
                    <linearGradient id="lineGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="flex gap-8">
                  {(['datasource', 'view', 'dashboard', 'output'] as NodeType[]).map((type, colIndex) => (
                    <div key={type} className="flex-1 min-w-[220px] space-y-4">
                      {nodesByType[type].map((node) => (
                        <div key={node.id} className="relative">
                          {colIndex < 3 && (
                            <div className="absolute left-full top-1/2 w-8 h-px">
                              <div
                                className={`h-full bg-gradient-to-r ${
                                  colIndex === 0
                                    ? 'from-blue-500/50 to-emerald-500/50'
                                    : colIndex === 1
                                      ? 'from-emerald-500/50 to-violet-500/50'
                                      : 'from-violet-500/50 to-amber-500/50'
                                }`}
                              />
                            </div>
                          )}
                          <NodeCard node={node} onSelect={setSelectedNode} isSelected={selectedNode?.id === node.id} />
                        </div>
                      ))}

                      <AddNodeButton type={type} onClick={() => handleAddNode(type)} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {selectedNode && (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-medium">{nodeConfig[selectedNode.type].label} Details</h3>
              <button onClick={() => setSelectedNode(null)} className="p-1 rounded hover:bg-zinc-800">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Name</label>
                <p className="font-medium">{selectedNode.name}</p>
              </div>
              {selectedNode.description && (
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Description</label>
                  <p className="text-sm text-zinc-400">{selectedNode.description}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Status</label>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      selectedNode.status === 'active' ? 'bg-emerald-500' : selectedNode.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-sm capitalize">{selectedNode.status || 'active'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 space-y-2">
                <button
                  onClick={() => router.push(getNodeDetailHref(selectedNode))}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
                <button
                  onClick={() => router.push(`/project-agent/chat?projectId=${encodeURIComponent(workstreamId)}`)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                >
                  <Play className="w-4 h-4" />
                  Run / Refresh
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-red-400">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

