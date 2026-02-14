'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileOutput, Play, Trash2, Loader2, Mail, FileText, Webhook, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Output {
  id: string;
  name: string;
  type: string;
  schedule?: string;
  config?: Record<string, unknown>;
  status?: string;
  lastRunAt?: string;
  dashboardId?: string;
  createdAt: string;
}

const typeIcons: Record<string, typeof FileOutput> = {
  pdf: FileText,
  email: Mail,
  webhook: Webhook,
};

export default function OutputDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [output, setOutput] = useState<Output | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    async function fetchOutput() {
      try {
        const res = await fetch(`/api/outputs/${id}`);
        if (res.ok) {
          const data = await res.json();
          setOutput(data.output);
        } else {
          router.push('/outputs');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchOutput();
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm('Delete this output? This cannot be undone.')) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/outputs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/outputs');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    // TODO: Implement run output
    setTimeout(() => {
      setIsRunning(false);
      alert('Output executed! (Demo)');
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!output) {
    return null;
  }

  const Icon = typeIcons[output.type] || FileOutput;
  const lastRun = output.lastRunAt 
    ? new Date(output.lastRunAt).toLocaleString()
    : 'Never';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/outputs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Icon className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{output.name}</h1>
              <p className="text-gray-500 capitalize">{output.type} Output</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            className="gap-2"
            onClick={handleRunNow}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Now
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

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4">Status</h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              output.status === 'active' ? 'bg-emerald-500' :
              output.status === 'error' ? 'bg-red-500' :
              output.status === 'paused' ? 'bg-amber-500' :
              'bg-gray-400'
            }`} />
            <span className="font-medium capitalize">{output.status || 'Active'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Last run: {lastRun}</span>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4">Configuration</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Type</span>
            <span className="font-medium capitalize">{output.type}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Schedule</span>
            <span className="font-medium capitalize">{output.schedule || 'Manual'}</span>
          </div>
          {output.config && Object.entries(output.config).map(([key, value]) => (
            <div key={key} className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="font-medium">{String(value)}</span>
            </div>
          ))}
          <div className="flex justify-between py-2">
            <span className="text-gray-500">ID</span>
            <span className="font-mono text-xs">{output.id}</span>
          </div>
        </div>
      </div>

      {/* History placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold mb-4">Run History</h2>
        <p className="text-gray-500 text-center py-8">No runs yet</p>
      </div>
    </div>
  );
}
