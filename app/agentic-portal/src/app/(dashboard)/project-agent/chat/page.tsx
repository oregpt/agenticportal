'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { ChevronDown, Loader2, MessageSquare, Pencil, Plus, Search, Send, Star, Terminal, Trash2, Zap } from 'lucide-react';

type SourceType = 'bigquery' | 'postgres' | 'google_sheets' | 'google_sheets_live' | 'mcp_server';
type Project = { id: string; name: string; hasAgent?: boolean };
type DataSource = { id: string; name: string; type: SourceType; status: string; mcpProvider?: string | null };
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
type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  messageCount?: number;
  isPinned?: number;
};
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

function conversationLabelDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ProjectAgentChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [sources, setSources] = useState<DataSource[]>([]);
  const [dashboardOptions, setDashboardOptions] = useState<DashboardOption[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [loadingConversationId, setLoadingConversationId] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
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
  const [mcpQuickCommands, setMcpQuickCommands] = useState<Record<string, Array<{ label: string; prompt: string }>>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const enabledSources = useMemo(() => sources.filter((s) => s.status !== 'disabled'), [sources]);
  const selectedSource = useMemo(() => enabledSources.find((s) => s.id === chatSourceId) || null, [enabledSources, chatSourceId]);
  const quickCommands = useMemo(() => {
    if (selectedSource?.type === 'mcp_server' && selectedSource.mcpProvider) {
      return mcpQuickCommands[selectedSource.mcpProvider] || DATA_AGENT_COMMANDS;
    }
    return DATA_AGENT_COMMANDS;
  }, [selectedSource, mcpQuickCommands]);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((row) => String(row.title || '').toLowerCase().includes(query));
  }, [conversations, conversationSearch]);
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

  useEffect(() => {
    (async () => {
      try {
        const payload = await api('/api/datasources/mcp-providers');
        const providers = Array.isArray(payload.providers) ? payload.providers : [];
        const next: Record<string, Array<{ label: string; prompt: string }>> = {};
        for (const provider of providers) {
          const providerId = String(provider.id || '');
          if (!providerId) continue;
          next[providerId] = Array.isArray(provider.quickCommands) ? provider.quickCommands : [];
        }
        setMcpQuickCommands(next);
      } catch {
        setMcpQuickCommands({});
      }
    })();
  }, []);

  function setChatRoute(projectId: string, conversationId?: string) {
    const query = conversationId
      ? `?projectId=${encodeURIComponent(projectId)}&conversationId=${encodeURIComponent(conversationId)}`
      : `?projectId=${encodeURIComponent(projectId)}`;
    router.replace(`/project-agent/chat${query}`, { scroll: false });
  }

  async function loadConversations(projectId: string, preferredConversationId?: string) {
    const res = await api(`/api/project-agent/conversations?projectId=${encodeURIComponent(projectId)}`);
    const list = (res.conversations || []) as ConversationSummary[];
    setConversations(list);
    const targetConversationId =
      (preferredConversationId && list.find((row) => row.id === preferredConversationId)?.id) || list[0]?.id || '';
    if (targetConversationId) {
      await selectConversation(projectId, targetConversationId);
    } else {
      setSelectedConversationId('');
      setMessages([]);
      setChatRoute(projectId);
    }
  }

  async function selectConversation(projectId: string, conversationId: string) {
    if (!projectId || !conversationId) return;
    try {
      setLoadingConversationId(conversationId);
      const payload = await api(
        `/api/project-agent/conversations/${encodeURIComponent(conversationId)}?projectId=${encodeURIComponent(projectId)}`
      );
      setSelectedConversationId(conversationId);
      setMessages(
        (payload.messages || []).map((message: any) => ({
          id: String(message.id || nextMessageId()),
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: String(message.content || ''),
          dataRun: message.dataRunJson || undefined,
        }))
      );
      setSelectedMessageIds([]);
      setExpandedDataRuns({});
      setChatRoute(projectId, conversationId);
    } catch (e: any) {
      setError(e?.message || 'Failed to load conversation');
    } finally {
      setLoadingConversationId('');
    }
  }

  async function createConversation(projectId: string, title: string) {
    const payload = await api('/api/project-agent/conversations', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        title: String(title || 'New conversation').slice(0, 120),
      }),
    });
    const conversation = payload.conversation as ConversationSummary;
    setConversations((prev) => [conversation, ...prev.filter((row) => row.id !== conversation.id)]);
    setSelectedConversationId(conversation.id);
    setMessages([]);
    setSelectedMessageIds([]);
    setExpandedDataRuns({});
    setChatRoute(projectId, conversation.id);
    return conversation.id;
  }

  async function ensureConversation(projectId: string, seedPrompt: string) {
    if (selectedConversationId) return selectedConversationId;
    return createConversation(projectId, seedPrompt);
  }

  async function persistConversationMessages(
    projectId: string,
    conversationId: string,
    entries: Array<{ role: 'user' | 'assistant'; content: string; dataRun?: DataRunInfo }>
  ) {
    if (!conversationId || !entries.length) return;
    await api(`/api/project-agent/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        messages: entries.map((entry) => ({
          role: entry.role,
          content: entry.content,
          dataRunJson: entry.dataRun || null,
        })),
      }),
    });
    setConversations((prev) =>
      prev.map((row) =>
        row.id === conversationId
          ? { ...row, updatedAt: new Date().toISOString(), lastMessageAt: new Date().toISOString() }
          : row
      )
    );
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
    return { id, role: 'assistant' as const, content: String(content || ''), dataRun };
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
        const conversationFromUrl = searchParams.get('conversationId') || '';
        const initial =
          (fromUrl && list.find((proj) => proj.id === fromUrl)?.id) ||
          list.find((proj) => proj.hasAgent)?.id ||
          list[0]?.id ||
          '';
        setSelectedProjectId(initial);
        if (initial) {
          await refreshProjectContext(initial);
          await loadConversations(initial, conversationFromUrl);
        }
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
    const conversationId = await ensureConversation(selectedProjectId, prompt);
    const userMessage: Message = { id: nextMessageId(), role: 'user', content: prompt };
    setMessages((prev) => [...prev, userMessage]);
    await persistConversationMessages(selectedProjectId, conversationId, [{ role: 'user', content: prompt }]);
    try {
      const plan = (await api('/api/project-agent/deep-tools/plan', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, sourceId: chatSourceId, message: prompt }),
      })) as DeepToolPlan;
      if (plan.mode === 'confirm') {
        setPendingPlan(plan);
        const content = plan.summary || 'Action requires confirmation.';
        setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content }]);
        await persistConversationMessages(selectedProjectId, conversationId, [{ role: 'assistant', content }]);
        return;
      }
      if (plan.mode === 'read' && plan.action !== 'none') {
        setActiveTools(['Deep Tools']);
        const readResult = await api('/api/project-agent/deep-tools/execute', {
          method: 'POST',
          body: JSON.stringify({ projectId: selectedProjectId, action: plan.action, payload: plan.payload || {} }),
        });
        const assistant = await streamAssistantMessage(readResult.message || 'Done.');
        await persistConversationMessages(selectedProjectId, conversationId, [{ role: 'assistant', content: assistant.content }]);
        return;
      }

      setActiveTools(['Planner', 'Query']);
      const data = await api('/api/project-agent/chat', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, sourceId: chatSourceId, message: prompt }),
      });
      const assistant = await streamAssistantMessage(data.answer || 'No response.', data);
      await persistConversationMessages(selectedProjectId, conversationId, [
        { role: 'assistant', content: assistant.content, dataRun: data as DataRunInfo },
      ]);
    } catch (e: any) {
      const msg = e?.message || 'Failed to send message';
      const payload = e?.payload || {};
      setError(msg);
      if (payload?.trust?.sql) {
        const assistantMessage: Message = {
          id: nextMessageId(),
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
        };
        setMessages((prev) => [...prev, assistantMessage]);
        await persistConversationMessages(selectedProjectId, conversationId, [
          { role: 'assistant', content: assistantMessage.content, dataRun: assistantMessage.dataRun },
        ]);
      } else {
        const content = `Error: ${msg}`;
        setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content }]);
        await persistConversationMessages(selectedProjectId, conversationId, [{ role: 'assistant', content }]);
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
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'user', content: `Run workflow: ${workflow.name}` }]);
    try {
      await api(`/api/project-agent/workflows/${workflow.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content: `Workflow "${workflow.name}" started.` }]);
    } catch (e: any) {
      const msg = e?.message || 'Failed to run workflow';
      setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content: `Error: ${msg}` }]);
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
      setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content: res.message || 'Action completed.' }]);
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
                  ? `${nameBase} Metric`
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
        setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content: 'Saved SQL query spec.' }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: 'assistant',
            content: `Added ${mode.replace('add-', '')} block to dashboard ${res.dashboardArtifactId || ''}.`,
          },
        ]);
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

  async function handleNewConversation() {
    if (!selectedProjectId) return;
    try {
      await createConversation(selectedProjectId, 'New conversation');
    } catch (e: any) {
      setError(e?.message || 'Failed to create conversation');
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    if (!selectedProjectId) return;
    const confirmed = window.confirm('Delete this conversation?');
    if (!confirmed) return;
    try {
      const nextCandidateId = conversations.find((row) => row.id !== conversationId)?.id || '';
      await api(`/api/project-agent/conversations/${encodeURIComponent(conversationId)}?projectId=${encodeURIComponent(selectedProjectId)}`, {
        method: 'DELETE',
      });
      setConversations((prev) => prev.filter((row) => row.id !== conversationId));
      if (selectedConversationId === conversationId) {
        if (nextCandidateId) {
          await selectConversation(selectedProjectId, nextCandidateId);
        } else {
          setSelectedConversationId('');
          setMessages([]);
          setChatRoute(selectedProjectId);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to delete conversation');
    }
  }

  async function patchConversation(conversationId: string, patch: { title?: string; isPinned?: boolean }) {
    if (!selectedProjectId) return;
    await api(`/api/project-agent/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        projectId: selectedProjectId,
        ...patch,
      }),
    });
    setConversations((prev) =>
      prev.map((row) =>
        row.id === conversationId
          ? {
              ...row,
              ...(patch.title !== undefined ? { title: patch.title } : {}),
              ...(patch.isPinned !== undefined ? { isPinned: patch.isPinned ? 1 : 0 } : {}),
              updatedAt: new Date().toISOString(),
            }
          : row
      )
    );
  }

  async function renameConversation(conversationId: string, currentTitle: string) {
    const nextTitle = window.prompt('Rename conversation', currentTitle || 'Conversation');
    if (nextTitle == null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    try {
      await patchConversation(conversationId, { title: trimmed });
    } catch (e: any) {
      setError(e?.message || 'Failed to rename conversation');
    }
  }

  async function togglePinnedConversation(conversationId: string, currentPinned: boolean) {
    try {
      await patchConversation(conversationId, { isPinned: !currentPinned });
      setConversations((prev) =>
        [...prev].sort((a, b) => {
          const aPinned = a.id === conversationId ? !currentPinned : Number(a.isPinned || 0) === 1;
          const bPinned = Number(b.isPinned || 0) === 1;
          if (aPinned !== bPinned) return aPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to update pin');
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
          setConversations([]);
          setSelectedConversationId('');
          if (next) {
            setChatRoute(next);
            refreshProjectContext(next)
              .then(() => loadConversations(next))
              .catch(() => {});
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
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
          <Card className="overflow-hidden">
            <div className="border-b border-border p-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Conversations</p>
              <Button size="sm" variant="outline" onClick={() => void handleNewConversation()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New
              </Button>
            </div>
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={conversationSearch}
                  onChange={(e) => setConversationSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full h-8 rounded-md border border-input bg-background pl-8 pr-2 text-xs"
                />
              </div>
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-2 space-y-1">
              {filteredConversations.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</p>
              ) : (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void selectConversation(selectedProjectId, conversation.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void selectConversation(selectedProjectId, conversation.id);
                      }
                    }}
                    className={`w-full text-left rounded-md border p-2 transition-colors ${
                      selectedConversationId === conversation.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{conversation.title || 'Conversation'}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {conversation.messageCount || 0} message{Number(conversation.messageCount || 0) === 1 ? '' : 's'}
                          {conversationLabelDate(conversation.lastMessageAt || conversation.updatedAt)
                            ? ` • ${conversationLabelDate(conversation.lastMessageAt || conversation.updatedAt)}`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`text-muted-foreground hover:text-amber-600 ${Number(conversation.isPinned || 0) === 1 ? 'text-amber-500' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void togglePinnedConversation(conversation.id, Number(conversation.isPinned || 0) === 1);
                        }}
                        title={Number(conversation.isPinned || 0) === 1 ? 'Unfavorite conversation' : 'Favorite conversation'}
                      >
                        <Star className={`h-3.5 w-3.5 ${Number(conversation.isPinned || 0) === 1 ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          void renameConversation(conversation.id, conversation.title || '');
                        }}
                        title="Rename conversation"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteConversation(conversation.id);
                        }}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-foreground">{selectedProject?.name || 'Project'} Chat</p>
              <p className="text-muted-foreground text-xs">
                {loadingConversationId
                  ? 'Loading conversation...'
                  : selectedConversationId
                    ? 'Conversation loaded from history.'
                    : 'New conversation (messages save after first send).'}
              </p>
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
                                  Add Metric
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
                Add Metric
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
                  {quickCommands.map((cmd) => (
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
        </div>
      )}
    </div>
  );
}

