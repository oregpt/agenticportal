'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { ChevronDown, Loader2, Send, Terminal, Zap } from 'lucide-react';

type SourceType = 'bigquery' | 'postgres' | 'google_sheets' | 'google_sheets_live';
type Project = { id: string; name: string; hasAgent?: boolean };
type DataSource = { id: string; name: string; type: SourceType; status: string };
type DashboardOption = { id: string; name: string };
type Workflow = { id: string; name: string; enabled: number };
type DataRunInfo = {
  source: { id: string; name: string; type: SourceType };
  trust: {
    sql: string;
    rowCount: number;
    model: string;
    confidence?: number | null;
    sampleRows?: Array<Record<string, unknown>>;
    reasoning?: string;
  };
  runId?: string | null;
  artifactActions?: {
    canSaveTable?: boolean;
    canCreateChart?: boolean;
    canCreateKpi?: boolean;
    canAddToDashboard?: boolean;
    canSaveSql?: boolean;
  };
  querySpecDraft?: { name?: string; projectId?: string; sourceId?: string; sqlText?: string; metadataJson?: Record<string, unknown> };
};
type Message = { id: string; role: 'user' | 'assistant'; content: string; dataRun?: DataRunInfo };
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
  if (!res.ok) {
    const err: any = new Error(data?.error || `API error (${res.status})`);
    err.payload = data;
    throw err;
  }
  return data;
}

function nextMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ProjectAgentChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [sources, setSources] = useState<DataSource[]>([]);
  const [dashboardOptions, setDashboardOptions] = useState<DashboardOption[]>([]);
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
  const [expandedDataRuns, setExpandedDataRuns] = useState<Record<string, boolean>>({});
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [savingActionId, setSavingActionId] = useState<string>('');
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionMode, setActionMode] = useState<'add-table' | 'add-chart' | 'add-kpi' | null>(null);
  const [actionTargetMessageIds, setActionTargetMessageIds] = useState<string[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const enabledSources = useMemo(() => sources.filter((s) => s.status !== 'disabled'), [sources]);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectableMessageIds = useMemo(
    () => messages.filter((m) => m.role === 'assistant' && !!m.dataRun?.trust?.sql).map((m) => m.id),
    [messages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, activeTools]);

  useEffect(() => {
    setSelectedMessageIds((prev) => prev.filter((id) => selectableMessageIds.includes(id)));
  }, [selectableMessageIds]);

  function pushMessage(message: Omit<Message, 'id'>) {
    setMessages((prev) => [...prev, { id: nextMessageId(), ...message }]);
  }

  function toggleDataRun(messageId: string) {
    setExpandedDataRuns((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  }

  function toggleMessageSelection(messageId: string) {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    );
  }

  function openActionDialog(mode: 'add-table' | 'add-chart' | 'add-kpi', messageIds: string[]) {
    if (!messageIds.length) return;
    setActionMode(mode);
    setActionTargetMessageIds(messageIds);
    setSelectedDashboardId('');
    setActionDialogOpen(true);
  }

  async function streamAssistantMessage(content: string, dataRun?: DataRunInfo) {
    const id = nextMessageId();
    setMessages((prev) => [...prev, { id, role: 'assistant', content: '', dataRun }]);
    const chunks = String(content || '')
      .split(/(\s+)/)
      .filter((part) => part.length > 0);
    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, 12));
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, content: `${msg.content}${chunk}` } : msg))
      );
    }
  }

  async function refreshProjectContext(projectId: string) {
    const [sourceRes, wfRes, dashboardsRes] = await Promise.all([
      api(`/api/project-agent/sources?projectId=${encodeURIComponent(projectId)}`),
      api(`/api/project-agent/workflows?projectId=${encodeURIComponent(projectId)}`).catch(() => ({ workflows: [] })),
      api(`/api/artifacts?projectId=${encodeURIComponent(projectId)}&type=dashboard`).catch(() => ({ artifacts: [] })),
    ]);
    const nextSources = sourceRes.sources || [];
    setSources(nextSources);
    setWorkflows(wfRes.workflows || []);
    setDashboardOptions((dashboardsRes.artifacts || []).map((a: any) => ({ id: String(a.id), name: String(a.name || 'Dashboard') })));
    if (!nextSources.find((s: DataSource) => s.id === chatSourceId && s.status !== 'disabled')) {
      setChatSourceId(nextSources.find((s: DataSource) => s.status !== 'disabled')?.id || '');
    }
    setSelectedMessageIds([]);
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
    setActiveTools([]);
    pushMessage({ role: 'user', content: prompt });
    try {
      const plan = (await api('/api/project-agent/deep-tools/plan', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, sourceId: chatSourceId, message: prompt }),
      })) as DeepToolPlan;
      if (plan.mode === 'confirm') {
        setPendingPlan(plan);
        pushMessage({ role: 'assistant', content: plan.summary || 'Action requires confirmation.' });
        return;
      }
      if (plan.mode === 'read' && plan.action !== 'none') {
        setActiveTools(['Deep Tools']);
        const readResult = await api('/api/project-agent/deep-tools/execute', {
          method: 'POST',
          body: JSON.stringify({ projectId: selectedProjectId, action: plan.action, payload: plan.payload || {} }),
        });
        await streamAssistantMessage(readResult.message || 'Done.');
        return;
      }

      setActiveTools(['Planner', 'Query']);
      const data = await api('/api/project-agent/chat', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, sourceId: chatSourceId, message: prompt }),
      });
      await streamAssistantMessage(data.answer || 'No response.', data);
    } catch (e: any) {
      const msg = e?.message || 'Failed to send message';
      const payload = e?.payload || {};
      setError(msg);
      if (payload?.trust?.sql) {
        pushMessage({
          role: 'assistant',
          content: `Error: ${msg}`,
          dataRun: {
            source: {
              id: String(payload?.source?.id || chatSourceId || ''),
              name: String(payload?.source?.name || 'Unknown Source'),
              type: (payload?.source?.type || 'postgres') as SourceType,
            },
            trust: {
              sql: String(payload.trust.sql || ''),
              rowCount: Number(payload.trust.rowCount || 0),
              model: String(payload.trust.model || 'unknown'),
              confidence:
                Number.isFinite(Number(payload.trust.confidence))
                  ? Number(payload.trust.confidence)
                  : null,
              reasoning: String(payload.trust.reasoning || ''),
              sampleRows: Array.isArray(payload.trust.sampleRows) ? payload.trust.sampleRows : [],
            },
            runId: null,
            artifactActions: payload?.artifactActions || {
              canSaveSql: true,
              canSaveTable: false,
              canCreateChart: false,
              canCreateKpi: false,
              canAddToDashboard: false,
            },
            querySpecDraft: payload?.querySpecDraft || undefined,
          },
        });
      } else {
        pushMessage({ role: 'assistant', content: `Error: ${msg}` });
      }
    } finally {
      setActiveTools([]);
      setIsSending(false);
    }
  }

  async function runWorkflow(workflow: Workflow) {
    if (!selectedProjectId || runningWorkflowId) return;
    setRunningWorkflowId(workflow.id);
    setShowDataWorkflows(false);
    pushMessage({ role: 'user', content: `Run workflow: ${workflow.name}` });
    try {
      await api(`/api/project-agent/workflows/${workflow.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      pushMessage({ role: 'assistant', content: `Workflow "${workflow.name}" started.` });
    } catch (e: any) {
      const msg = e?.message || 'Failed to run workflow';
      pushMessage({ role: 'assistant', content: `Error: ${msg}` });
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
      pushMessage({ role: 'assistant', content: res.message || 'Action completed.' });
      await refreshProjectContext(selectedProjectId);
    } catch (e: any) {
      setError(e?.message || 'Failed to execute action');
    }
  }

  async function saveFromMessage(
    messageId: string,
    mode: 'save-sql' | 'add-table' | 'add-chart' | 'add-kpi',
    dashboardArtifactId?: string
  ) {
    const message = messages.find((m) => m.id === messageId);
    const dataRun = message?.dataRun;
    if (!dataRun?.trust?.sql || !selectedProjectId || !chatSourceId) return;

    const endpoint =
      mode === 'add-table'
        ? '/api/project-agent/chat/save-table'
        : mode === 'add-chart'
          ? '/api/project-agent/chat/create-chart'
          : mode === 'add-kpi'
            ? '/api/project-agent/chat/create-kpi'
            : '/api/project-agent/chat/save-sql';

    const nameBase = (dataRun.querySpecDraft?.name || message?.content || 'Chat Result').slice(0, 80);
    setSavingActionId(`${messageId}:${mode}`);
    setError('');
    try {
      const res = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          sourceId: dataRun.source.id || chatSourceId,
          sqlText: dataRun.trust.sql,
          name:
            mode === 'add-table'
              ? `${nameBase} Table`
              : mode === 'add-chart'
                ? `${nameBase} Chart`
                : mode === 'add-kpi'
                  ? `${nameBase} KPI`
                  : `${nameBase} Query`,
          metadataJson: dataRun.querySpecDraft?.metadataJson || {
            rowCount: dataRun.trust.rowCount,
            confidence: dataRun.trust.confidence ?? null,
            sampleRows: dataRun.trust.sampleRows || [],
            reasoning: dataRun.trust.reasoning || null,
          },
          dashboardArtifactId: dashboardArtifactId || undefined,
        }),
      });
      if (mode === 'save-sql') {
        pushMessage({ role: 'assistant', content: 'Saved SQL query spec.' });
      } else {
        pushMessage({
          role: 'assistant',
          content: `Added ${mode.replace('add-', '')} block to dashboard ${res.dashboardArtifactId || ''}.`,
        });
      }
    } catch (e: any) {
      setError(e?.message || `Failed to ${mode}`);
    } finally {
      setSavingActionId('');
    }
  }

  async function runActionForMessages(
    mode: 'save-sql' | 'add-table' | 'add-chart' | 'add-kpi',
    messageIds: string[],
    dashboardArtifactId?: string
  ) {
    for (const messageId of messageIds) {
      await saveFromMessage(messageId, mode, dashboardArtifactId);
    }
  }

  async function executeDialogAction() {
    if (!actionMode || actionTargetMessageIds.length === 0) return;
    await runActionForMessages(actionMode, actionTargetMessageIds, selectedDashboardId || undefined);
    setActionDialogOpen(false);
    setActionMode(null);
    setActionTargetMessageIds([]);
    setSelectedMessageIds([]);
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
              messages.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'ml-auto max-w-[86%]' : 'mr-auto max-w-[86%]'}>
                  <div className={m.role === 'user' ? 'rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm shadow-sm' : 'rounded-xl bg-card border border-border px-3 py-2 text-sm shadow-sm'}>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.role === 'assistant' && m.dataRun ? (
                      <div className="mt-2">
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedMessageIds.includes(m.id)}
                            onChange={() => toggleMessageSelection(m.id)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-[11px] text-muted-foreground">Select</span>
                        </div>
                        <button
                          onClick={() => toggleDataRun(m.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/80"
                          title="Show data run details"
                        >
                          <span>{`1 query - ${m.dataRun.trust.rowCount} rows${m.dataRun.trust.confidence != null ? ` - confidence ${Number(m.dataRun.trust.confidence).toFixed(2)}` : ''}`}</span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedDataRuns[m.id] ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedDataRuns[m.id] ? (
                          <div className="mt-2 rounded-md border border-border bg-muted/60 p-2 text-xs">
                            <div className="mb-1">
                              <strong>Source:</strong> {m.dataRun.source.name} ({m.dataRun.source.type})
                              {m.dataRun.runId ? ` - run ${m.dataRun.runId}` : ''}
                            </div>
                            <div className="mb-1">
                              <strong>Model:</strong> {m.dataRun.trust.model} - <strong>Rows:</strong> {m.dataRun.trust.rowCount}
                              {m.dataRun.trust.confidence != null ? ` - Confidence: ${Number(m.dataRun.trust.confidence).toFixed(2)}` : ''}
                            </div>
                            <div className="mb-1 font-semibold">Generated Query</div>
                            <pre className="overflow-x-auto rounded-md bg-slate-950 text-slate-100 p-2 text-[11px]">
                              {m.dataRun.trust.sql}
                            </pre>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {(m.dataRun.artifactActions?.canSaveSql ?? true) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => saveFromMessage(m.id, 'save-sql')}
                                  disabled={savingActionId === `${m.id}:save-sql`}
                                >
                                  {savingActionId === `${m.id}:save-sql` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                  Save SQL
                                </Button>
                              ) : null}
                              {(m.dataRun.artifactActions?.canSaveTable ?? true) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openActionDialog('add-table', [m.id])}
                                  disabled={savingActionId === `${m.id}:add-table`}
                                >
                                  {savingActionId === `${m.id}:add-table` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                  Add Table
                                </Button>
                              ) : null}
                              {(m.dataRun.artifactActions?.canCreateChart ?? true) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openActionDialog('add-chart', [m.id])}
                                  disabled={savingActionId === `${m.id}:add-chart`}
                                >
                                  {savingActionId === `${m.id}:add-chart` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                  Add Chart
                                </Button>
                              ) : null}
                              {(m.dataRun.artifactActions?.canCreateKpi ?? true) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openActionDialog('add-kpi', [m.id])}
                                  disabled={savingActionId === `${m.id}:add-kpi`}
                                >
                                  {savingActionId === `${m.id}:add-kpi` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                  Add KPI
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {isSending ? (
              <div className="mr-auto max-w-[86%]">
                <div className="rounded-xl bg-card border border-border px-3 py-2 text-sm shadow-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '-0.2s' }} />
                      <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '-0.1s' }} />
                      <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
                    </span>
                    <span className="text-xs">
                      {activeTools.length > 0 ? `Processing: ${activeTools.join(' - ')}` : 'Thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedMessageIds.length > 0
                  ? `${selectedMessageIds.length} selected`
                  : 'Select assistant messages to apply actions'}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedMessageIds.length === 0}
                onClick={() => runActionForMessages('save-sql', selectedMessageIds)}
              >
                Save SQL
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedMessageIds.length === 0}
                onClick={() => openActionDialog('add-table', selectedMessageIds)}
              >
                Add Table
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedMessageIds.length === 0}
                onClick={() => openActionDialog('add-chart', selectedMessageIds)}
              >
                Add Chart
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedMessageIds.length === 0}
                onClick={() => openActionDialog('add-kpi', selectedMessageIds)}
              >
                Add KPI
              </Button>
              {selectedMessageIds.length > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedMessageIds([])}
                >
                  Clear
                </Button>
              ) : null}
            </div>
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

            <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Select Dashboard</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Choose where to add this block. If none selected, the default project dashboard is used.
                  </p>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedDashboardId}
                    onChange={(e) => setSelectedDashboardId(e.target.value)}
                  >
                    <option value="">Default Project Dashboard (Auto)</option>
                    {dashboardOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
                    <Button onClick={executeDialogAction}>Continue</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>
        </Card>
      )}
    </div>
  );
}

