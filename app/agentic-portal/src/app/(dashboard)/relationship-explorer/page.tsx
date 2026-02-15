'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Network, Database, Table2, LayoutDashboard, FileOutput, ExternalLink, Plus, Minus, Link2, Move } from 'lucide-react';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { FilterPresetManager } from '@/components/filters/FilterPresetManager';
import { Button } from '@/components/ui/button';

interface WorkstreamOption {
  id: string;
  name: string;
}

type NodeType = 'datasource' | 'view' | 'dashboard' | 'output';

interface PipelineNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  parentIds: string[];
}

interface NodePosition {
  x: number;
  y: number;
}

const typeConfig: Record<NodeType, { icon: typeof Database; label: string; color: string; light: string }> = {
  datasource: { icon: Database, label: 'Data Source', color: 'text-blue-600', light: 'bg-blue-50 border-blue-200' },
  view: { icon: Table2, label: 'View', color: 'text-emerald-600', light: 'bg-emerald-50 border-emerald-200' },
  dashboard: { icon: LayoutDashboard, label: 'Dashboard', color: 'text-violet-600', light: 'bg-violet-50 border-violet-200' },
  output: { icon: FileOutput, label: 'Output', color: 'text-amber-600', light: 'bg-amber-50 border-amber-200' },
};

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
      return '#';
  }
}

function buildDefaultPositions(nodes: PipelineNode[]): Record<string, NodePosition> {
  const byType: Record<NodeType, PipelineNode[]> = {
    datasource: [],
    view: [],
    dashboard: [],
    output: [],
  };
  for (const node of nodes) byType[node.type].push(node);

  const typeOrder: NodeType[] = ['datasource', 'view', 'dashboard', 'output'];
  const positions: Record<string, NodePosition> = {};

  typeOrder.forEach((type, typeIndex) => {
    byType[type].forEach((node, idx) => {
      positions[node.id] = {
        x: 60 + typeIndex * 300,
        y: 70 + idx * 120,
      };
    });
  });

  return positions;
}

function RelationshipExplorerPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'columns' | 'mindmap'>('mindmap');
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const selectedWorkstreamId = searchParams.get('workstreamId') || undefined;

  useEffect(() => {
    const fetchWorkstreams = async () => {
      try {
        const res = await fetch('/api/workstreams');
        if (!res.ok) return;
        const data = await res.json();
        const options = (data.workstreams || []).map((ws: { id: string; name: string }) => ({ id: ws.id, name: ws.name }));
        setWorkstreams(options);

        if (!selectedWorkstreamId && options.length > 0) {
          router.replace(`/relationship-explorer?workstreamId=${options[0].id}`, { scroll: false });
        }
      } catch (error) {
        console.error('Failed to fetch workstreams:', error);
      }
    };

    fetchWorkstreams();
  }, [router, selectedWorkstreamId]);

  useEffect(() => {
    if (!selectedWorkstreamId) {
      setIsLoading(false);
      setNodes([]);
      return;
    }

    const fetchGraph = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/workstreams/${selectedWorkstreamId}`);
        if (!res.ok) return;
        const data = await res.json();
        const nextNodes = (data.nodes || []) as PipelineNode[];
        setNodes(nextNodes);
        setNodePositions(buildDefaultPositions(nextNodes));
      } catch (error) {
        console.error('Failed to fetch workstream graph:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraph();
  }, [selectedWorkstreamId]);

  const nodesById = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);

  const childrenById = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const node of nodes) {
      for (const parentId of node.parentIds || []) {
        map[parentId] = map[parentId] || [];
        map[parentId].push(node.id);
      }
    }
    return map;
  }, [nodes]);

  const nodesByType = useMemo(
    () => ({
      datasource: nodes.filter((node) => node.type === 'datasource'),
      view: nodes.filter((node) => node.type === 'view'),
      dashboard: nodes.filter((node) => node.type === 'dashboard'),
      output: nodes.filter((node) => node.type === 'output'),
    }),
    [nodes]
  );

  const edges = useMemo(() => {
    const list: Array<{ from: PipelineNode; to: PipelineNode }> = [];
    for (const node of nodes) {
      for (const parentId of node.parentIds || []) {
        const parent = nodesById[parentId] as PipelineNode | undefined;
        if (parent) list.push({ from: parent, to: node });
      }
    }
    return list;
  }, [nodes, nodesById]);

  const updateWorkstream = (workstreamId: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!workstreamId) {
      params.delete('workstreamId');
    } else {
      params.set('workstreamId', workstreamId);
    }
    router.replace(`/relationship-explorer${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const applyPreset = (query: string) => {
    router.replace(`/relationship-explorer${query ? `?${query}` : ''}`, { scroll: false });
  };

  const toggleExpanded = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    setDraggingNodeId(nodeId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    if (draggingNodeId !== nodeId) return;
    setNodePositions((prev) => {
      const current = prev[nodeId] || { x: 0, y: 0 };
      return {
        ...prev,
        [nodeId]: {
          x: Math.max(16, current.x + event.movementX),
          y: Math.max(16, current.y + event.movementY),
        },
      };
    });
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    setDraggingNodeId(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in-up">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            Relationship Explorer
          </h1>
          <p className="text-muted-foreground mt-1">Explore how sources, views, dashboards, and outputs connect</p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === 'columns' ? 'default' : 'outline'} onClick={() => setViewMode('columns')}>
            Column View
          </Button>
          <Button variant={viewMode === 'mindmap' ? 'default' : 'outline'} onClick={() => setViewMode('mindmap')}>
            Mind Map
          </Button>
        </div>
      </div>

      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={updateWorkstream}
        rightSlot={<FilterPresetManager pageKey="relationship-explorer" currentQuery={searchParams.toString()} onApply={applyPreset} />}
      />

      {isLoading ? (
        <div className="ui-empty">
          <p className="text-muted-foreground">Loading graph...</p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="ui-empty">
          <p className="text-muted-foreground">No entities found for this workstream yet.</p>
        </div>
      ) : viewMode === 'columns' ? (
        <div className="grid min-w-[980px] grid-cols-4 gap-8 rounded-2xl border border-border bg-white/60 p-5">
          {(['datasource', 'view', 'dashboard', 'output'] as NodeType[]).map((type, colIndex) => (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2 px-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {(() => {
                  const Icon = typeConfig[type].icon;
                  return <Icon className={`h-3.5 w-3.5 ${typeConfig[type].color}`} />;
                })()}
                <span>{typeConfig[type].label}s</span>
                <span>({nodesByType[type].length})</span>
              </div>

              {nodesByType[type].map((node) => {
                const relatedParentNodes = (node.parentIds || []).map((id) => nodesById[id]).filter(Boolean) as PipelineNode[];
                const relatedChildNodes = (childrenById[node.id] || []).map((id) => nodesById[id]).filter(Boolean) as PipelineNode[];
                const isExpanded = expandedNodeIds.has(node.id);
                const Icon = typeConfig[type].icon;

                return (
                  <div key={node.id} className="relative">
                    {colIndex < 3 ? <div className="absolute left-full top-10 h-0.5 w-8 bg-gradient-to-r from-gray-300 to-gray-200" /> : null}
                    <div className={`rounded-xl border p-3 ${typeConfig[type].light}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${typeConfig[type].color}`} />
                            <p className="truncate text-sm font-medium text-foreground">{node.name}</p>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.description || 'No description'}</p>
                        </div>
                        <button
                          onClick={() => toggleExpanded(node.id)}
                          className="rounded-md border border-border bg-white p-1.5 hover:bg-muted"
                          aria-label="Toggle related entities"
                        >
                          {isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Link2 className="h-3 w-3" />
                          {relatedParentNodes.length + relatedChildNodes.length} related
                        </span>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={getEntityUrl(node)}>
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Open
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="relative h-[680px] overflow-auto rounded-2xl border border-border bg-white/60 p-4">
          <svg className="absolute left-0 top-0 h-full w-full pointer-events-none" aria-hidden>
            {edges.map((edge, idx) => {
              const from = nodePositions[edge.from.id];
              const to = nodePositions[edge.to.id];
              if (!from || !to) return null;

              const x1 = from.x + 248;
              const y1 = from.y + 44;
              const x2 = to.x;
              const y2 = to.y + 44;
              const c1 = x1 + 80;
              const c2 = x2 - 80;
              const path = `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`;

              return (
                <path
                  key={`${edge.from.id}-${edge.to.id}-${idx}`}
                  d={path}
                  fill="none"
                  stroke="rgba(148,163,184,0.8)"
                  strokeWidth="2"
                  strokeDasharray="7 7"
                  className="animate-[dashMove_1.4s_linear_infinite]"
                />
              );
            })}
          </svg>

          {nodes.map((node) => {
            const pos = nodePositions[node.id] || { x: 0, y: 0 };
            const config = typeConfig[node.type];
            const Icon = config.icon;
            return (
              <div
                key={node.id}
                className={`absolute w-[248px] rounded-xl border p-3 shadow-sm ${config.light} ${draggingNodeId === node.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ left: pos.x, top: pos.y }}
                onPointerDown={(event) => handleDragStart(event, node.id)}
                onPointerMove={(event) => handleDragMove(event, node.id)}
                onPointerUp={handleDragEnd}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <p className="truncate text-sm font-medium">{node.name}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.description || 'No description'}</p>
                  </div>
                  <Move className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={getEntityUrl(node)}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}

          <style jsx>{`
            @keyframes dashMove {
              to {
                stroke-dashoffset: -14;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default function RelationshipExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-7xl mx-auto text-muted-foreground">
          Loading relationship explorer...
        </div>
      }
    >
      <RelationshipExplorerPageContent />
    </Suspense>
  );
}
