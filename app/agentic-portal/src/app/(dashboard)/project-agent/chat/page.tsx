'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { Loader2, Send, Terminal, Zap } from 'lucide-react';

type SourceType = 'bigquery' | 'postgres' | 'google_sheets' | 'google_sheets_live';
type Project = { id: string; name: string; hasAgent?: boolean };
type DataSource = { id: string; name: string; type: SourceType; status: string };
type Workflow = { id: string; name: string; enabled: number };
type DataRunInfo = { source: { id: string; name: string; type: SourceType }; trust: { sql: string; rowCount: number; model: string }; runId?: string | null };
type Message = { role: 'user' | 'assistant'; content: string; dataRun?: DataRunInfo };
type DeepToolPlan = {
  mode: 'none' | 'confirm' | 'read';
  action: 'create_workflow' | 'create_memory_rule' | 'list_workflows' | 'list_memory_rules' | 'list_workflow_runs' | 'none';
  summary?: string;
  payload?: Record<string, unknown>;
};

const DATA_AGENT_COMMANDS = [
  { label: 'Source summary', prompt: 'Give me a one-paragraph summary of this source and top tables.' },
  { label: 'List workflows', prompt: 'List all active workflows and what each one does.' },
  { label: 'List memory rules', prompt: 'List all active memory rules for this data source.' },
];

async function api(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error (${res.status})`);
  return data;
}

export default function ProjectAgentChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [sources, setSources] = useState<DataSource[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [chatSourceId, setChatSourceId] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingPlan, setPendingPlan] = useState<DeepToolPlan | null>(null);
  const [showDataCommands, setShowDataCommands] = useState(false);
  const [showDataWorkflows, setShowDataWorkflows] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [runningWorkflowId, setRunningWorkflowId] = useState('');
  const [error, setError] = useState('');

  const enabledSources = useMemo(() => sources.filter((s) => s.status !== 'disabled'), [sources]);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  async function refreshProjectContext(projectId: string) {
    const [sourceRes, wfRes] = await Promise.all([
      api(`/api/project-agent/sources?projectId=${encodeURIComponent(projectId)}`),
      api(`/api/project-agent/workflows?projectId=${encodeURIComponent(projectId)}`).catch(() => ({ workflows: [] })),
    ]);
    const nextSources = sourceRes.sources || [];
    setSources(nextSources);
    setWorkflows(wfRes.workflows || []);
    if (!nextSources.find((s: DataSource) => s.id === chatSourceId && s.status !== 'disabled')) {
      setChatSourceId(nextSources.find((s: DataSource) => s.status !== 'disabled')?.id || '');
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const p = await api('/api/project-agent/projects');
        const list: Project[] = p.projects || [];
        setProjects(list);
        const fromUrl = searchParams.get('projectId') || '';
        const initial =
          (fromUrl && list.find((proj) => proj.id === fromUrl)?.id) ||
          list.find((proj) => proj.hasAgent)?.id ||
          list[0]?.id ||
          '';
        setSelectedProjectId(initial);
        if (initial) await refreshProjectContext(initial);
      } catch (e: any) {
        setError(e?.message || 'Failed to load project agent chat');
      }
    })();
  }, [searchParams]);

  async function sendMessage(text: string) {
    if (!selectedProjectId || !chatSourceId || !text.trim()) return;
    const prompt = text.trim();
    setIsSending(true);
    setError('');
    setPendingPlan(null);
    setShowDataCommands(false);
    setShowDataWorkflows(false);
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    try {
      const plan = (await api('/api/project-agent/deep-tools/plan', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, sourceId: chatSourceId, message: prompt }),
      })) as DeepToolPlan;
      if (plan.mode === 'confirm') {
        setPendingPlan(plan);
        setMessages((prev) => [...prev, { role: 'assistant', content: plan.summary || 'Action requires confirmation.' }]);
        return;
      }
      if (plan.mode === 'read' && plan.action !== 'none') {
        const readResult = await api('/api/project-agent/deep-tools/execute', {
          method: 'POST',
          body: JSON.stringify({ projectId: selectedProjectId, action: plan.action, payload: plan.payload || {} }),
        });
        setMessages((prev) => [...prev, { role: 'assistant', content: readResult.message || 'Done.' }]);
        return;
      }

      const data = await api('/api/project-agent/chat', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, sourceId: chatSourceId, message: prompt }),
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer || 'No response.', dataRun: data }]);
    } catch (e: any) {
      const msg = e?.message || 'Failed to send message';
      setError(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setIsSending(false);
    }
  }

  async function runWorkflow(workflow: Workflow) {
    if (!selectedProjectId || runningWorkflowId) return;
    setRunningWorkflowId(workflow.id);
    setShowDataWorkflows(false);
    setMessages((prev) => [...prev, { role: 'user', content: `Run workflow: ${workflow.name}` }]);
    try {
      await api(`/api/project-agent/workflows/${workflow.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: `Workflow "${workflow.name}" started.` }]);
    } catch (e: any) {
      const msg = e?.message || 'Failed to run workflow';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setRunningWorkflowId('');
    }
  }

  async function executePendingPlan() {
    if (!pendingPlan || !selectedProjectId) return;
    try {
      const res = await api('/api/project-agent/deep-tools/execute', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          action: pendingPlan.action,
          payload: pendingPlan.payload || {},
        }),
      });
      setPendingPlan(null);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.message || 'Action completed.' }]);
      await refreshProjectContext(selectedProjectId);
    } catch (e: any) {
      setError(e?.message || 'Failed to execute action');
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <WorkstreamFilterBar
        workstreams={projects.map((p) => ({ id: p.id, name: p.name }))}
        selectedWorkstreamId={selectedProjectId}
        onWorkstreamChange={(value) => {
          const next = value || projects[0]?.id || '';
          setSelectedProjectId(next);
          setMessages([]);
          if (next) {
            router.replace(`/project-agent/chat?projectId=${encodeURIComponent(next)}`, { scroll: false });
            refreshProjectContext(next).catch(() => {});
          }
        }}
        pageLabel="Project Agent Chat"
        pageDescription="Dedicated chat runtime for the selected project agent."
        rightSlot={
          <Button asChild variant="outline">
            <Link href="/project-agent">Back to Project Agent</Link>
          </Button>
        }
      />

      {!selectedProject?.hasAgent ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">This project does not have a Project Agent yet.</p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/project-agent">Create Project Agent</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-foreground">{selectedProject?.name || 'Project'} Chat</p>
              <p className="text-muted-foreground text-xs">Full chat page for project agent runtime.</p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={chatSourceId}
                onChange={(e) => setChatSourceId(e.target.value)}
              >
                {enabledSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-[58vh] overflow-y-auto p-4 space-y-3 bg-muted/10">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Start chatting with your project data agent.</p>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className={m.role === 'user' ? 'ml-auto max-w-[85%]' : 'mr-auto max-w-[85%]'}>
                  <div className={m.role === 'user' ? 'rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm' : 'rounded-xl bg-card border border-border px-3 py-2 text-sm'}>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.dataRun?.trust?.sql ? (
                      <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 text-slate-100 p-2 text-xs">{m.dataRun.trust.sql}</pre>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-4">
            <div className="relative flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowDataCommands((v) => !v);
                  setShowDataWorkflows(false);
                }}
                title="Commands"
              >
                <Terminal className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowDataWorkflows((v) => !v);
                  setShowDataCommands(false);
                }}
                title="Workflows"
              >
                <Zap className="w-4 h-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Ask a question (Shift+Enter for new line)'
                className="min-h-[52px] max-h-44 resize-y"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const text = input;
                    setInput('');
                    sendMessage(text);
                  }
                }}
              />
              <Button
                onClick={() => {
                  const text = input;
                  setInput('');
                  sendMessage(text);
                }}
                disabled={isSending || !input.trim() || !chatSourceId}
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>

              {showDataCommands ? (
                <div className="absolute left-0 bottom-14 z-20 w-[430px] max-w-[95vw] rounded-lg border border-border bg-background shadow-lg">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Commands</div>
                  {DATA_AGENT_COMMANDS.map((cmd) => (
                    <div key={cmd.label} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border last:border-b-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{cmd.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{cmd.prompt}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => { setInput(cmd.prompt); setShowDataCommands(false); }}>
                          Edit
                        </Button>
                        <Button size="sm" onClick={() => sendMessage(cmd.prompt)}>
                          Send
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {showDataWorkflows ? (
                <div className="absolute left-11 bottom-14 z-20 w-[360px] max-w-[92vw] rounded-lg border border-border bg-background shadow-lg">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Workflows</div>
                  {workflows.filter((w) => w.enabled === 1).map((w) => (
                    <div key={w.id} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0">
                      <p className="text-sm">{w.name}</p>
                      <Button size="sm" variant="outline" onClick={() => runWorkflow(w)} disabled={!!runningWorkflowId}>
                        {runningWorkflowId === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Run'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {pendingPlan ? (
              <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold">Deep Tool Confirmation Required</p>
                <p className="text-sm text-muted-foreground mt-1">{pendingPlan.summary || 'Confirm this action.'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" onClick={executePendingPlan}>Confirm and Execute</Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingPlan(null)}>Cancel</Button>
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>
        </Card>
      )}
    </div>
  );
}
