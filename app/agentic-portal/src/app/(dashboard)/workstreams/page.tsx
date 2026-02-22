'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Workflow, 
  Database, 
  Table2, 
  LayoutDashboard,
  FileOutput,
  ChevronRight,
  Calendar,
  Layers,
  Search,
  Loader2,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WorkstreamStats {
  dataSources: number;
  views: number;
  dashboards: number;
  outputs: number;
}

interface Workstream {
  id: string;
  name: string;
  description: string | null;
  color: string;
  stats: WorkstreamStats;
  createdAt: string;
  updatedAt: string;
}

// Color options for workstreams
const colorOptions = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export default function WorkstreamsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingWorkstreamId, setDeletingWorkstreamId] = useState<string | null>(null);
  const [newWorkstream, setNewWorkstream] = useState({
    name: '',
    description: '',
    color: '#8b5cf6'
  });

  const fetchWorkstreams = async () => {
    try {
      const response = await fetch('/api/workstreams');
      if (response.ok) {
        const data = await response.json();
        setWorkstreams(data.workstreams || []);
      }
    } catch (error) {
      console.error('Error fetching workstreams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkstreams();
  }, []);

  const handleCreate = async () => {
    if (!newWorkstream.name) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/workstreams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkstream),
      });

      if (response.ok) {
        const data = await response.json();
        setWorkstreams(prev => [data.workstream, ...prev]);
        setShowCreateModal(false);
        setNewWorkstream({ name: '', description: '', color: '#8b5cf6' });
        toast({ title: 'Project created', description: 'You can now add data sources, views, and dashboards.' });
      } else {
        toast({ title: 'Could not create project', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Could not create project', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (workstream: Workstream) => {
    const confirmed = window.confirm(
      `Delete project "${workstream.name}"?\n\nThis removes the project container. Related data sources, views, dashboards, and outputs will remain and become unassigned.`
    );
    if (!confirmed) return;

    setDeletingWorkstreamId(workstream.id);
    try {
      const response = await fetch(`/api/workstreams/${workstream.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWorkstreams((prev) => prev.filter((ws) => ws.id !== workstream.id));
        toast({
          title: 'Project deleted',
          description: 'Related items were kept and unassigned from this project.',
        });
        return;
      }

      const data = await response.json().catch(() => ({}));
      toast({
        title: 'Could not delete project',
        description: data?.error || 'Please try again.',
        variant: 'destructive',
      });
    } catch {
      toast({
        title: 'Could not delete project',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingWorkstreamId(null);
    }
  };

  const filteredWorkstreams = workstreams.filter(ws => 
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ws.description && ws.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Overview
          </h1>
          <p className="text-muted-foreground">
            Organize your data flow from connection to dashboard
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowCreateModal(true)}>Create Project</Button>
          <Link href="/datasources">
            <Button variant="outline">Connect Data</Button>
          </Link>
          <Link href="/views/new?mode=chat">
            <Button variant="outline">Create View</Button>
          </Link>
          <Link href="/dashboards/new">
            <Button variant="outline">Create Dashboard</Button>
          </Link>
          <Link href="/outputs">
            <Button variant="outline">Create Output</Button>
          </Link>
        </div>
      </div>

      {/* Pipeline Legend */}
      <div className="flex items-center gap-6 mb-8 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
        <span className="font-medium">The flow:</span>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-500" />
          <span>Sources</span>
        </div>
        <ChevronRight className="w-4 h-4" />
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-emerald-500" />
          <span>Views</span>
        </div>
        <ChevronRight className="w-4 h-4" />
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-violet-500" />
          <span>Dashboards</span>
        </div>
        <ChevronRight className="w-4 h-4" />
        <div className="flex items-center gap-2">
          <FileOutput className="w-4 h-4 text-amber-500" />
          <span>Outputs</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search projects..."
          className="w-full bg-background border border-input rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Workstream Cards */}
      {!isLoading && (
        <div className="grid gap-4">
          {filteredWorkstreams.map((ws) => (
            <div key={ws.id} className="group block">
              <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${ws.color}15` }}
                    >
                      <Workflow className="w-6 h-6" style={{ color: ws.color }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-0.5 group-hover:text-primary transition-colors">
                        {ws.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {ws.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {formatDate(ws.updatedAt)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deletingWorkstreamId === ws.id}
                      onClick={() => void handleDelete(ws)}
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      {deletingWorkstreamId === ws.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Visual flow mini-view */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                    <Database className="w-4 h-4 text-blue-500" />
                    <span className="text-blue-600 dark:text-blue-400 font-medium">{ws.stats.dataSources}</span>
                    <span className="text-blue-500/60">sources</span>
                  </div>
                  
                  <div className="w-6 h-px bg-gradient-to-r from-blue-500/50 to-emerald-500/50" />
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm">
                    <Table2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{ws.stats.views}</span>
                    <span className="text-emerald-500/60">views</span>
                  </div>
                  
                  <div className="w-6 h-px bg-gradient-to-r from-emerald-500/50 to-violet-500/50" />
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg text-sm">
                    <LayoutDashboard className="w-4 h-4 text-violet-500" />
                    <span className="text-violet-600 dark:text-violet-400 font-medium">{ws.stats.dashboards}</span>
                    <span className="text-violet-500/60">dashboards</span>
                  </div>
                  
                  <div className="w-6 h-px bg-gradient-to-r from-violet-500/50 to-amber-500/50" />
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                    <FileOutput className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-medium">{ws.stats.outputs}</span>
                    <span className="text-amber-500/60">outputs</span>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => router.push(`/workstream-canvas/${ws.id}`)}
                    className="ml-auto flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors"
                  >
                    <span className="text-sm">Open canvas</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredWorkstreams.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
            <Layers className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {searchQuery ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery 
              ? "Try adjusting your search"
              : "Projects help you organize your data flow from sources to dashboards."
            }
          </p>
          {!searchQuery && (
            <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-primary" />
              Create Project
            </DialogTitle>
            <DialogDescription>
              A project groups your data from source to dashboard
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={newWorkstream.name}
                onChange={(e) => setNewWorkstream(ws => ({ ...ws, name: e.target.value }))}
                placeholder="e.g., Q1 Financial Analysis"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Description (optional)</label>
              <textarea
                value={newWorkstream.description}
                onChange={(e) => setNewWorkstream(ws => ({ ...ws, description: e.target.value }))}
                placeholder="What is this project for?"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[80px] resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewWorkstream(ws => ({ ...ws, color }))}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      newWorkstream.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleCreate}
                disabled={!newWorkstream.name || isCreating}
              >
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

