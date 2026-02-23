'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';

type SourceType = 'bigquery' | 'postgres' | 'google_sheets' | 'google_sheets_live';
type DataFeatures = {
  dataQueryRuns: boolean;
  dataMemoryRules: boolean;
  dataWorkflows: boolean;
  dataDeepTools: boolean;
  dataAnnotations: boolean;
};
type Project = {
  id: string;
  name: string;
  description?: string | null;
  hasAgent?: boolean;
  defaultModel?: string | null;
  instructions?: string;
};
type DataSource = { id: string; name: string; type: SourceType; status: string; userNotes?: string; inferredNotes?: string };
type DataQueryRun = { id: string; status: string; message: string; rowCount: number; sqlText?: string | null; createdAt: string };
type MemoryRule = { id: string; name: string; ruleText: string; enabled: number; priority: number; sourceId?: string | null };
type Workflow = { id: string; name: string; enabled: number; definition: { steps: Array<{ sourceId?: string; message: string }> } };
type WorkflowRun = { id: string; workflowId: string; status: string; startedAt: string; error?: string | null };
type ProjectChatResponse = {
  runId?: string | null;
  answer: string;
  source: { id: string; name: string; type: SourceType };
  trust: { sql: string; rowCount: number; model: string; confidence?: number | null };
};
type DeepToolPlan = {
  mode: 'none' | 'confirm' | 'read';
  action: 'create_workflow' | 'create_memory_rule' | 'list_workflows' | 'list_memory_rules' | 'list_workflow_runs' | 'none';
  summary?: string;
  payload?: Record<string, unknown>;
  message?: string;
};

const section: CSSProperties = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginTop: 14 };
const field: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' };
const btn = (bg: string): CSSProperties => ({ border: 'none', backgroundColor: bg, color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' });
const toggleStyle = (on: boolean): CSSProperties => ({
  width: 44,
  height: 24,
  borderRadius: 12,
  backgroundColor: on ? '#0f766e' : '#cbd5e1',
  position: 'relative',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  border: 'none',
  padding: 0,
  flexShrink: 0,
});
const toggleKnob = (on: boolean): CSSProperties => ({
  width: 18,
  height: 18,
  borderRadius: '50%',
  backgroundColor: '#ffffff',
  position: 'absolute',
  top: 3,
  left: on ? 23 : 3,
  transition: 'left 0.2s',
  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
});

const RULE_SAMPLE = 'Always include chain name and wallet address in answers.';
const WORKFLOW_SAMPLE = 'Summarize balances by chain\nThen list top 10 transactions by amount\nThen provide executive summary';

async function api(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error (${res.status})`);
  return data;
}

export default function ProjectAgentPage() {
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [features, setFeatures] = useState<DataFeatures>({
    dataQueryRuns: true,
    dataMemoryRules: true,
    dataWorkflows: true,
    dataDeepTools: true,
    dataAnnotations: true,
  });
  const [savingFeature, setSavingFeature] = useState('');
  const [agentInstructions, setAgentInstructions] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [newAgentProjectId, setNewAgentProjectId] = useState('');
  const [newAgentInstructions, setNewAgentInstructions] = useState('');

  const [sources, setSources] = useState<DataSource[]>([]);
  const [chatSourceId, setChatSourceId] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatResult, setChatResult] = useState<ProjectChatResponse | null>(null);
  const [chatting, setChatting] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<DeepToolPlan | null>(null);

  const [runs, setRuns] = useState<DataQueryRun[]>([]);
  const [rules, setRules] = useState<MemoryRule[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [runningWorkflowId, setRunningWorkflowId] = useState('');

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [rulePriority, setRulePriority] = useState('100');
  const [ruleSourceId, setRuleSourceId] = useState('');

  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowStepsText, setWorkflowStepsText] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');
  const [savingGlobalNotes, setSavingGlobalNotes] = useState(false);
  const [sourceNotesDraft, setSourceNotesDraft] = useState<Record<string, string>>({});
  const [savingSourceNotesId, setSavingSourceNotesId] = useState('');
  const [generatingGlobalDraft, setGeneratingGlobalDraft] = useState(false);
  const [generatingSourceDraftId, setGeneratingSourceDraftId] = useState('');

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId), [projects, selectedProjectId]);
  const enabledSources = sources.filter((s) => s.status !== 'disabled');

  function jumpToSection(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function refreshAll(projectId: string) {
    if (!projectId) return;
    const [featureRes, sourceRes] = await Promise.all([
      api(`/api/project-agent/features?projectId=${encodeURIComponent(projectId)}`),
      api(`/api/project-agent/sources?projectId=${encodeURIComponent(projectId)}`),
    ]);
    setFeatures({
      dataQueryRuns: !!featureRes.features?.dataQueryRuns,
      dataMemoryRules: !!featureRes.features?.dataMemoryRules,
      dataWorkflows: !!featureRes.features?.dataWorkflows,
      dataDeepTools: !!featureRes.features?.dataDeepTools,
      dataAnnotations: !!featureRes.features?.dataAnnotations,
    });
    const nextSources = sourceRes.sources || [];
    setSources(nextSources);
    const notesMap: Record<string, string> = {};
    for (const s of nextSources) notesMap[s.id] = typeof s.userNotes === 'string' ? s.userNotes : '';
    setSourceNotesDraft(notesMap);
    if (featureRes.features?.dataAnnotations) {
      const annotations = await api(`/api/project-agent/annotations?projectId=${encodeURIComponent(projectId)}`).catch(() => null);
      setGlobalNotes((annotations?.globalNotes as string) || '');
    } else {
      setGlobalNotes('');
    }

    const settingsRes = await api(`/api/project-agent/settings?projectId=${encodeURIComponent(projectId)}`).catch(() => null);
    setAgentInstructions(settingsRes?.settings?.instructions || '');
  }

  async function refreshDataExtras(projectId: string, featureState: DataFeatures) {
    if (featureState.dataQueryRuns) api(`/api/project-agent/runs?projectId=${encodeURIComponent(projectId)}&limit=20`).then((d) => setRuns(d.runs || [])).catch(() => setRuns([]));
    else setRuns([]);
    if (featureState.dataMemoryRules) api(`/api/project-agent/memory-rules?projectId=${encodeURIComponent(projectId)}`).then((d) => setRules(d.rules || [])).catch(() => setRules([]));
    else setRules([]);
    if (featureState.dataWorkflows) {
      Promise.all([
        api(`/api/project-agent/workflows?projectId=${encodeURIComponent(projectId)}`),
        api(`/api/project-agent/workflow-runs?projectId=${encodeURIComponent(projectId)}&limit=10`),
      ])
        .then(([a, b]) => {
          setWorkflows(a.workflows || []);
          setWorkflowRuns(b.runs || []);
        })
        .catch(() => {
          setWorkflows([]);
          setWorkflowRuns([]);
        });
    } else {
      setWorkflows([]);
      setWorkflowRuns([]);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const p = await api('/api/project-agent/projects');
        const list: Project[] = p.projects || [];
        setProjects(list);
        const initial = list[0]?.id || '';
        setSelectedProjectId(initial);
        if (initial && list[0]?.hasAgent) await refreshAll(initial);
      } catch (e: any) {
        setError(e?.message || 'Failed to load Project Agent');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (!selectedProject?.hasAgent) return;
    refreshAll(selectedProjectId).catch(() => {});
  }, [selectedProjectId, selectedProject?.hasAgent]);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (!selectedProject?.hasAgent) return;
    refreshDataExtras(selectedProjectId, features).catch(() => {});
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (!selectedProject?.hasAgent) return;
    refreshDataExtras(selectedProjectId, features).catch(() => {});
  }, [selectedProjectId, features]);

  useEffect(() => {
    if (!sources.find((s) => s.id === chatSourceId && s.status !== 'disabled')) {
      setChatSourceId(enabledSources[0]?.id || '');
    }
  }, [sources, chatSourceId, enabledSources]);

  async function toggleFeature(key: keyof DataFeatures, value: boolean) {
    if (!selectedProjectId) return;
    setSavingFeature(key);
    try {
      const d = await api('/api/project-agent/features', {
        method: 'PUT',
        body: JSON.stringify({ projectId: selectedProjectId, [key]: value }),
      });
      setFeatures(d.features);
      if (key === 'dataAnnotations') await refreshAll(selectedProjectId);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setSavingFeature('');
    }
  }

  async function runChat() {
    if (!selectedProjectId || !chatSourceId || !chatMessage.trim()) return;
    try {
      setChatting(true);
      setPendingPlan(null);

      if (features.dataDeepTools) {
        const plan = (await api('/api/project-agent/deep-tools/plan', {
          method: 'POST',
          body: JSON.stringify({ projectId: selectedProjectId, sourceId: chatSourceId, message: chatMessage.trim() }),
        })) as DeepToolPlan;

        if (plan.mode === 'confirm') {
          setPendingPlan(plan);
          setFlash(plan.summary || 'Please confirm this deep tool action.');
          return;
        }

        if (plan.mode === 'read' && plan.action !== 'none') {
          const readResult = await api('/api/project-agent/deep-tools/execute', {
            method: 'POST',
            body: JSON.stringify({ projectId: selectedProjectId, action: plan.action, payload: plan.payload || {} }),
          });
          setChatResult({
            answer: readResult.message || 'Deep tool read completed.',
            source: { id: chatSourceId, name: 'deep-tools', type: 'postgres' as SourceType },
            trust: { sql: 'DEEP_TOOL_READ', rowCount: 0, model: 'deep-tools' },
          });
          return;
        }
      }

      const data = await api('/api/project-agent/chat', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, sourceId: chatSourceId, message: chatMessage.trim() }),
      });
      setChatResult(data);
      if (features.dataQueryRuns) {
        const r = await api(`/api/project-agent/runs?projectId=${encodeURIComponent(selectedProjectId)}&limit=20`);
        setRuns(r.runs || []);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to run chat');
    } finally {
      setChatting(false);
    }
  }

  async function createAgentForProject() {
    if (!selectedProjectId) return;
    try {
      setCreatingAgent(true);
      await api('/api/project-agent/create', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          instructions: agentInstructions,
          defaultModel: 'claude-sonnet-4-20250514',
        }),
      });
      const p = await api('/api/project-agent/projects');
      const list: Project[] = p.projects || [];
      setProjects(list);
      setFlash('Project Agent created.');
      await refreshAll(selectedProjectId);
      await refreshDataExtras(selectedProjectId, features);
    } catch (e: any) {
      setError(e?.message || 'Failed to create Project Agent');
    } finally {
      setCreatingAgent(false);
    }
  }

  async function createAgentFromModal() {
    if (!newAgentProjectId) return;
    try {
      setCreatingAgent(true);
      await api('/api/project-agent/create', {
        method: 'POST',
        body: JSON.stringify({
          projectId: newAgentProjectId,
          instructions: newAgentInstructions,
          defaultModel: 'claude-sonnet-4-20250514',
        }),
      });
      const p = await api('/api/project-agent/projects');
      const list: Project[] = p.projects || [];
      setProjects(list);
      setSelectedProjectId(newAgentProjectId);
      setAgentInstructions(newAgentInstructions);
      setShowNewAgentModal(false);
      setNewAgentInstructions('');
      setFlash('Project Agent created.');
      await refreshAll(newAgentProjectId);
      await refreshDataExtras(newAgentProjectId, features);
      setTimeout(() => jumpToSection('project-agent-settings'), 120);
    } catch (e: any) {
      setError(e?.message || 'Failed to create Project Agent');
    } finally {
      setCreatingAgent(false);
    }
  }

  async function saveAgentSettings() {
    if (!selectedProjectId) return;
    try {
      setSavingSettings(true);
      await api('/api/project-agent/settings', {
        method: 'PUT',
        body: JSON.stringify({
          projectId: selectedProjectId,
          instructions: agentInstructions,
        }),
      });
      setFlash('Agent instructions saved.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  }

  async function executePendingPlan() {
    if (!selectedProjectId || !pendingPlan) return;
    try {
      const data = await api('/api/project-agent/deep-tools/execute', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, action: pendingPlan.action, payload: pendingPlan.payload || {} }),
      });
      setPendingPlan(null);
      setFlash(data.message || 'Deep tool action completed.');
      await refreshDataExtras(selectedProjectId, features);
      setChatResult({
        answer: data.message || 'Action completed.',
        source: { id: chatSourceId, name: 'deep-tools', type: 'postgres' as SourceType },
        trust: { sql: 'DEEP_TOOL_ACTION', rowCount: 0, model: 'deep-tools' },
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to execute deep tool action');
    }
  }

  async function createRule() {
    if (!selectedProjectId || !ruleName.trim() || !ruleText.trim()) return;
    try {
      await api('/api/project-agent/memory-rules', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          name: ruleName,
          ruleText,
          priority: Number(rulePriority || 100),
          sourceId: ruleSourceId || null,
        }),
      });
      setShowRuleModal(false);
      setRuleName('');
      setRuleText('');
      setRulePriority('100');
      setRuleSourceId('');
      const d = await api(`/api/project-agent/memory-rules?projectId=${encodeURIComponent(selectedProjectId)}`);
      setRules(d.rules || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to create rule');
    }
  }

  async function toggleRule(rule: MemoryRule) {
    if (!selectedProjectId) return;
    await api(`/api/project-agent/memory-rules/${rule.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ projectId: selectedProjectId, enabled: !(rule.enabled === 1) }),
    });
    const d = await api(`/api/project-agent/memory-rules?projectId=${encodeURIComponent(selectedProjectId)}`);
    setRules(d.rules || []);
  }

  async function createWorkflow() {
    if (!selectedProjectId || !workflowName.trim()) return;
    const steps = workflowStepsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((message) => ({ message }));
    if (!steps.length) return setError('Add at least one step (one prompt per line).');
    try {
      await api('/api/project-agent/workflows', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, name: workflowName, definition: { steps } }),
      });
      setShowWorkflowModal(false);
      setWorkflowName('');
      setWorkflowStepsText('');
      const d = await api(`/api/project-agent/workflows?projectId=${encodeURIComponent(selectedProjectId)}`);
      setWorkflows(d.workflows || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to create workflow');
    }
  }

  async function runWorkflow(workflowId: string) {
    if (!selectedProjectId) return;
    try {
      setRunningWorkflowId(workflowId);
      await api(`/api/project-agent/workflows/${workflowId}/run`, {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const [a, b] = await Promise.all([
        api(`/api/project-agent/workflows?projectId=${encodeURIComponent(selectedProjectId)}`),
        api(`/api/project-agent/workflow-runs?projectId=${encodeURIComponent(selectedProjectId)}&limit=10`),
      ]);
      setWorkflows(a.workflows || []);
      setWorkflowRuns(b.runs || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to run workflow');
    } finally {
      setRunningWorkflowId('');
    }
  }

  async function saveGlobalNotes() {
    if (!selectedProjectId) return;
    try {
      setSavingGlobalNotes(true);
      await api('/api/project-agent/annotations/global', {
        method: 'PUT',
        body: JSON.stringify({ projectId: selectedProjectId, globalNotes }),
      });
      setFlash('Global notes saved.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save global notes');
    } finally {
      setSavingGlobalNotes(false);
    }
  }

  async function saveSourceNotes(sourceId: string) {
    if (!selectedProjectId) return;
    try {
      setSavingSourceNotesId(sourceId);
      await api(`/api/project-agent/sources/${sourceId}/annotations`, {
        method: 'PUT',
        body: JSON.stringify({
          projectId: selectedProjectId,
          userNotes: sourceNotesDraft[sourceId] || '',
        }),
      });
      setFlash('Source notes saved.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save source notes');
    } finally {
      setSavingSourceNotesId('');
    }
  }

  async function generateCrossSourceDraft() {
    if (!selectedProjectId) return;
    try {
      setGeneratingGlobalDraft(true);
      const d = await api('/api/project-agent/annotations/generate-cross-source', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      setGlobalNotes(d.draft || '');
      setFlash('Cross-source draft generated.');
    } catch (e: any) {
      setError(e?.message || 'Failed to generate cross-source notes');
    } finally {
      setGeneratingGlobalDraft(false);
    }
  }

  async function generateSourceDraft(sourceId: string) {
    if (!selectedProjectId) return;
    try {
      setGeneratingSourceDraftId(sourceId);
      const d = await api('/api/project-agent/annotations/generate-source', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, sourceId }),
      });
      setSourceNotesDraft((prev) => ({
        ...prev,
        [sourceId]: d.draft || prev[sourceId] || '',
      }));
      setFlash('Source draft generated.');
    } catch (e: any) {
      setError(e?.message || 'Failed to generate source draft');
    } finally {
      setGeneratingSourceDraftId('');
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Project Agent</h1>
          <p style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>
            Full data-agent module scoped to a single project.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={btn('#0f766e')}
            onClick={() => {
              const candidate = projects.find((p) => !p.hasAgent) || projects[0];
              setNewAgentProjectId(candidate?.id || '');
              setNewAgentInstructions('');
              setShowNewAgentModal(true);
            }}
          >
            New Agent
          </button>
          <select
            style={{ ...field, width: 280 }}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Link href={`/datasources${selectedProjectId ? `?workstreamId=${encodeURIComponent(selectedProjectId)}` : ''}`} style={btn('#475569')}>
            Manage Sources
          </Link>
        </div>
      </div>

      {selectedProject ? (
        <div style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>
          Project: <strong>{selectedProject.name}</strong>
        </div>
      ) : null}

      {!!flash && <div style={{ ...section, borderColor: '#99f6e4', backgroundColor: '#f0fdfa', color: '#134e4a' }}>{flash}</div>}
      {!!error && <div style={{ ...section, borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      <div style={section}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Project Agents</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {projects.map((project) => {
            const hasAgent = !!project.hasAgent;
            return (
              <div key={project.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{project.name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{hasAgent ? 'Agent configured' : 'No agent yet'}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, backgroundColor: hasAgent ? '#dcfce7' : '#f1f5f9', color: hasAgent ? '#166534' : '#475569' }}>
                    {hasAgent ? 'Active' : 'Not Created'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    style={btn('#334155')}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      if (!hasAgent) {
                        setNewAgentProjectId(project.id);
                        setNewAgentInstructions(project.instructions || '');
                        setShowNewAgentModal(true);
                        return;
                      }
                      setTimeout(() => jumpToSection('project-agent-settings'), 120);
                    }}
                  >
                    Configure
                  </button>
                  <button
                    style={btn(hasAgent ? '#0f766e' : '#94a3b8')}
                    disabled={!hasAgent}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setTimeout(() => jumpToSection('project-agent-chat'), 120);
                    }}
                  >
                    Chat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!selectedProject?.hasAgent ? (
        <div style={section}>
          <h3 style={{ marginTop: 0 }}>Create Project Agent</h3>
          <p style={{ marginTop: 0, color: '#64748b', fontSize: 13 }}>
            This project does not have a Project Agent yet. Create one to enable data chat, memory rules, workflows, and annotations.
          </p>
          <div style={{ marginBottom: 8, fontSize: 12, color: '#334155' }}>Instructions</div>
          <textarea
            style={{ ...field, minHeight: 140 }}
            value={agentInstructions}
            onChange={(e) => setAgentInstructions(e.target.value)}
            placeholder="Optional: add project-specific analysis instructions for the agent."
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button style={btn('#0f766e')} onClick={createAgentForProject} disabled={creatingAgent}>
              {creatingAgent ? 'Creating...' : 'Create Project Agent'}
            </button>
          </div>
        </div>
      ) : (
      <>
      <div id="project-agent-settings" style={section}>
        <h3 style={{ marginTop: 0 }}>Agent Settings</h3>
        <textarea
          style={{ ...field, minHeight: 100 }}
          value={agentInstructions}
          onChange={(e) => setAgentInstructions(e.target.value)}
          placeholder="Project-specific instructions."
        />
        <div style={{ marginTop: 8 }}>
          <button style={btn('#0f766e')} onClick={saveAgentSettings} disabled={savingSettings}>
            {savingSettings ? 'Saving...' : 'Save Instructions'}
          </button>
        </div>
      </div>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Feature Controls</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {(
            [
              { key: 'dataQueryRuns', label: 'Query Run History' },
              { key: 'dataMemoryRules', label: 'Memory Rules' },
              { key: 'dataWorkflows', label: 'Workflows' },
              { key: 'dataDeepTools', label: 'Data Deep Tools' },
              { key: 'dataAnnotations', label: 'Data Annotations' },
            ] as Array<{ key: keyof DataFeatures; label: string }>
          ).map((f) => (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
              <div style={{ fontSize: 13 }}>{f.label}</div>
              <button
                style={toggleStyle(features[f.key])}
                onClick={() => toggleFeature(f.key, !features[f.key])}
                disabled={savingFeature === f.key}
              >
                <span style={toggleKnob(features[f.key])} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {features.dataAnnotations && (
        <div style={section}>
          <h3 style={{ marginTop: 0 }}>Annotations</h3>
          <textarea style={{ ...field, minHeight: 110 }} value={globalNotes} onChange={(e) => setGlobalNotes(e.target.value)} />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button style={btn('#0f766e')} onClick={saveGlobalNotes} disabled={savingGlobalNotes}>
              {savingGlobalNotes ? 'Saving...' : 'Save Global Notes'}
            </button>
            <button style={btn('#475569')} onClick={generateCrossSourceDraft} disabled={generatingGlobalDraft}>
              {generatingGlobalDraft ? 'Generating...' : 'Generate Cross-Source Draft'}
            </button>
          </div>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {sources.map((s) => (
              <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong>{s.name}</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btn('#334155')} onClick={() => generateSourceDraft(s.id)} disabled={generatingSourceDraftId === s.id}>
                      {generatingSourceDraftId === s.id ? 'Generating...' : 'Generate Draft'}
                    </button>
                    <button style={btn('#0f766e')} onClick={() => saveSourceNotes(s.id)} disabled={savingSourceNotesId === s.id}>
                      {savingSourceNotesId === s.id ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
                <textarea
                  style={{ ...field, minHeight: 80 }}
                  value={sourceNotesDraft[s.id] || ''}
                  onChange={(e) => setSourceNotesDraft((prev) => ({ ...prev, [s.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div id="project-agent-chat" style={section}>
        <h3 style={{ marginTop: 0 }}>Data Chat</h3>
        {!enabledSources.length ? (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: 13, color: '#334155', marginBottom: 8 }}>
              No data sources are assigned to this project yet.
            </div>
            <Link href={`/datasources?workstreamId=${encodeURIComponent(selectedProjectId)}`} style={btn('#475569')}>
              Add Project Data Source
            </Link>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ ...field, width: 320 }} value={chatSourceId} onChange={(e) => setChatSourceId(e.target.value)}>
            {enabledSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type})
              </option>
            ))}
          </select>
          <button style={btn('#334155')} onClick={() => setShowRuleModal(true)}>
            + Memory Rule
          </button>
          <button style={btn('#334155')} onClick={() => setShowWorkflowModal(true)}>
            + Workflow
          </button>
        </div>
        <textarea
          style={{ ...field, minHeight: 90, marginTop: 8 }}
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          placeholder='Ask a question, or try: "create workflow \"Weekly Wallet Report\" then summarize balances by chain"'
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button style={btn('#0f766e')} onClick={runChat} disabled={chatting}>
            {chatting ? 'Running...' : 'Run'}
          </button>
          {pendingPlan && (
            <button style={btn('#7c2d12')} onClick={executePendingPlan}>
              Confirm: {pendingPlan.summary || pendingPlan.action}
            </button>
          )}
        </div>
        {chatResult && (
          <div style={{ marginTop: 10 }}>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{chatResult.answer}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              rows {chatResult.trust.rowCount} | model {chatResult.trust.model} {chatResult.runId ? `| run ${chatResult.runId}` : ''}
            </div>
            <pre style={{ marginTop: 8, padding: 10, backgroundColor: '#0f172a', color: '#e2e8f0', borderRadius: 8, fontSize: 12, overflowX: 'auto' }}>
              {chatResult.trust.sql}
            </pre>
          </div>
        )}
      </div>

      {features.dataQueryRuns && (
        <div style={section}>
          <h3 style={{ marginTop: 0 }}>Query Runs</h3>
          {!runs.length ? (
            <p style={{ color: '#64748b', fontSize: 13 }}>No runs yet.</p>
          ) : (
            runs.map((r) => (
              <div key={r.id} style={{ fontSize: 12, borderBottom: '1px solid #e2e8f0', padding: '6px 0' }}>
                <strong>{r.status}</strong> | {r.rowCount} rows | {new Date(r.createdAt).toLocaleString()}
                <div style={{ color: '#64748b' }}>{r.message}</div>
                {r.sqlText ? <code>{r.sqlText}</code> : null}
              </div>
            ))
          )}
        </div>
      )}

      {features.dataMemoryRules && (
        <div style={section}>
          <h3 style={{ marginTop: 0 }}>Memory Rules</h3>
          {!rules.length ? (
            <p style={{ color: '#64748b', fontSize: 13 }}>No rules yet.</p>
          ) : (
            rules.map((r) => (
              <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{r.name}</strong>
                  <button style={btn('#475569')} onClick={() => toggleRule(r)}>
                    {r.enabled === 1 ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  priority {r.priority} | {r.enabled === 1 ? 'enabled' : 'disabled'}
                </div>
                <div style={{ marginTop: 6, fontSize: 13 }}>{r.ruleText}</div>
              </div>
            ))
          )}
        </div>
      )}

      {features.dataWorkflows && (
        <div style={section}>
          <h3 style={{ marginTop: 0 }}>Workflows</h3>
          {!workflows.length ? (
            <p style={{ color: '#64748b', fontSize: 13 }}>No workflows yet.</p>
          ) : (
            workflows.map((w) => (
              <div key={w.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{w.name}</strong>
                  <button style={btn('#475569')} disabled={w.enabled !== 1 || runningWorkflowId === w.id} onClick={() => runWorkflow(w.id)}>
                    {runningWorkflowId === w.id ? 'Running...' : 'Run'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {w.enabled === 1 ? 'enabled' : 'disabled'} | {w.definition.steps.length} steps
                </div>
              </div>
            ))
          )}
          {!!workflowRuns.length && (
            <div style={{ marginTop: 10 }}>
              {workflowRuns.map((r) => (
                <div key={r.id} style={{ fontSize: 12, borderBottom: '1px solid #e2e8f0', padding: '4px 0' }}>
                  <strong>{r.status}</strong> {r.workflowId} {new Date(r.startedAt).toLocaleString()} {r.error ? `| ${r.error}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showRuleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowRuleModal(false)}>
          <div style={{ ...section, width: 560, maxWidth: '95vw', marginTop: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Create Memory Rule</h3>
            <input style={{ ...field, marginBottom: 8 }} value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Rule name" />
            <textarea style={{ ...field, minHeight: 100, marginBottom: 8 }} value={ruleText} onChange={(e) => setRuleText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Tab' && !ruleText.trim()) { e.preventDefault(); setRuleText(RULE_SAMPLE); } }} placeholder='Rule text (press Tab for sample)' />
            <input style={{ ...field, marginBottom: 8 }} value={rulePriority} onChange={(e) => setRulePriority(e.target.value)} placeholder="Priority (default 100)" />
            <select style={{ ...field, marginBottom: 8 }} value={ruleSourceId} onChange={(e) => setRuleSourceId(e.target.value)}>
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn('#0f766e')} onClick={createRule}>
                Save Rule
              </button>
              <button style={btn('#64748b')} onClick={() => setShowRuleModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showWorkflowModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowWorkflowModal(false)}>
          <div style={{ ...section, width: 620, maxWidth: '95vw', marginTop: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Create Workflow</h3>
            <input style={{ ...field, marginBottom: 8 }} value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder="Workflow name" />
            <textarea style={{ ...field, minHeight: 140, marginBottom: 8 }} value={workflowStepsText} onChange={(e) => setWorkflowStepsText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Tab' && !workflowStepsText.trim()) { e.preventDefault(); setWorkflowStepsText(WORKFLOW_SAMPLE); } }} placeholder="One prompt per line (press Tab for sample)" />
            <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap' }}>Example:{'\n'}{WORKFLOW_SAMPLE}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button style={btn('#0f766e')} onClick={createWorkflow}>
                Save Workflow
              </button>
              <button style={btn('#64748b')} onClick={() => setShowWorkflowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewAgentModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowNewAgentModal(false)}>
          <div style={{ ...section, width: 620, maxWidth: '95vw', marginTop: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Create Project Agent</h3>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#334155' }}>Project</div>
            <select
              style={{ ...field, marginBottom: 8 }}
              value={newAgentProjectId}
              onChange={(e) => setNewAgentProjectId(e.target.value)}
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} disabled={!!p.hasAgent}>
                  {p.name}{p.hasAgent ? ' (already has agent)' : ''}
                </option>
              ))}
            </select>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#334155' }}>Instructions</div>
            <textarea
              style={{ ...field, minHeight: 140 }}
              value={newAgentInstructions}
              onChange={(e) => setNewAgentInstructions(e.target.value)}
              placeholder="Optional: add project-specific analysis instructions for the agent."
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button style={btn('#0f766e')} disabled={creatingAgent || !newAgentProjectId} onClick={createAgentFromModal}>
                {creatingAgent ? 'Creating...' : 'Create Agent'}
              </button>
              <button style={btn('#64748b')} disabled={creatingAgent} onClick={() => setShowNewAgentModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
