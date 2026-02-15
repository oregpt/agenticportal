'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileOutput, Play, Trash2, Loader2, Mail, FileText, Webhook, Clock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const scheduleLabelMap: Record<string, string> = {
  on_demand: 'On-demand',
  manual: 'On-demand',
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function OutputDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [output, setOutput] = useState<Output | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('on_demand');
  const [email, setEmail] = useState('');
  const [contentMode, setContentMode] = useState<'full_dashboard' | 'top_widgets' | 'custom_summary'>('full_dashboard');
  const [customPrompt, setCustomPrompt] = useState('');

  useEffect(() => {
    async function fetchOutput() {
      try {
        const res = await fetch(`/api/outputs/${id}`);
        if (res.ok) {
          const data = await res.json();
          setOutput(data.output);
          setName(data.output.name || '');
          setSchedule(data.output.schedule || 'on_demand');
          setEmail((data.output.config?.email as string) || '');
          setContentMode(((data.output.config?.contentMode as string) || 'full_dashboard') as 'full_dashboard' | 'top_widgets' | 'custom_summary');
          setCustomPrompt((data.output.config?.customPrompt as string) || '');
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

  const handleSave = async () => {
    if (!output) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/outputs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          schedule,
          config: {
            email: output.type === 'email' ? email : undefined,
            contentMode,
            customPrompt: contentMode === 'custom_summary' ? customPrompt : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setOutput(data.output);
      alert('Output settings saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save output';
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    try {
      const res = await fetch(`/api/outputs/${id}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run output');
      }
      alert(`Output executed${data.sentTo ? ` and emailed to ${data.sentTo}` : ''}`);

      const refreshed = await fetch(`/api/outputs/${id}`);
      if (refreshed.ok) {
        const refreshedData = await refreshed.json();
        setOutput(refreshedData.output);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run output';
      alert(message);
    } finally {
      setIsRunning(false);
    }
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
  const lastRun = output.lastRunAt ? new Date(output.lastRunAt).toLocaleString() : 'Never';

  return (
    <div className="max-w-3xl mx-auto">
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
          <Button className="gap-2" onClick={handleRunNow} disabled={isRunning}>
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Now
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
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

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4">Status</h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                output.status === 'active'
                  ? 'bg-emerald-500'
                  : output.status === 'error'
                    ? 'bg-red-500'
                    : output.status === 'paused'
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
              }`}
            />
            <span className="font-medium capitalize">{output.status || 'Active'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Last run: {lastRun}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-5">
        <h2 className="font-semibold">Output Definition</h2>

        <div>
          <label className="text-sm font-medium text-gray-700">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
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

        {output.type === 'email' ? (
          <div>
            <label className="text-sm font-medium text-gray-700">Recipient Email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              placeholder="team@company.com"
              type="email"
            />
          </div>
        ) : null}

        <div>
          <label className="text-sm font-medium text-gray-700">Content Mode</label>
          <Select value={contentMode} onValueChange={(value) => setContentMode(value as 'full_dashboard' | 'top_widgets' | 'custom_summary')}>
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
            <label className="text-sm font-medium text-gray-700">Custom Prompt</label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="mt-1 min-h-[96px]"
              placeholder="Summarize major changes and alert conditions."
            />
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4">Current Configuration</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Type</span>
            <span className="font-medium capitalize">{output.type}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Schedule</span>
            <span className="font-medium">{scheduleLabelMap[output.schedule || 'on_demand'] || output.schedule || 'On-demand'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">ID</span>
            <span className="font-mono text-xs">{output.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
