import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser, canAccessPlatformAdmin } from '@/lib/auth';
import {
  applyTemplate,
  appendProjectConversationMessages,
  createProjectAgent,
  createProjectConversation,
  createProjectMemoryRule,
  createProjectWorkflow,
  deleteProjectConversation,
  deleteProjectMemoryRule,
  deleteProjectWorkflow,
  executeProjectDeepTool,
  getProjectConversation,
  getProjectAgentFeatures,
  getProjectAgentSettings,
  getProjectAgentGlobalNotes,
  getProjectAgentPromptTemplates,
  getProjectDataQueryRun,
  getProjectDataSourceById,
  getProjectWorkflowRun,
  introspectSavedProjectSource,
  isProjectAgentModuleEnabled,
  isProjectFeatureEnabled,
  listProjectAgents,
  listProjectConversations,
  listProjectDataQueryRuns,
  listProjectDataSources,
  listProjectMemoryRules,
  listProjectWorkflowRuns,
  listProjectWorkflows,
  planProjectDeepTool,
  runProjectAgentChat,
  runProjectWorkflow,
  setProjectMemoryRuleEnabled,
  setProjectWorkflowEnabled,
  setProjectDataSourceEnabled,
  testSavedProjectSource,
  updateProjectAgentFeatures,
  updateProjectAgentGlobalNotes,
  updateProjectAgentSettings,
  updateProjectConversationTitle,
  updateProjectAgentPromptTemplates,
  updateProjectMemoryRule,
  updateProjectSourceNotes,
  updateProjectWorkflow,
} from '@/server/project-agent';
import { getProviderForModel } from '@/server/llm';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

function serializeProjectSource(source: any) {
  const config = (source?.config || {}) as Record<string, unknown>;
  return {
    id: source.id,
    organizationId: source.organizationId,
    projectId: source.projectId,
    name: source.name,
    type: source.type,
    status: source.status,
    userNotes: source.userNotes || '',
    inferredNotes: source.inferredNotes || '',
    schemaCache: source.schemaCache || null,
    lastSyncedAt: source.lastSyncedAt || null,
    updatedAt: source.updatedAt,
    mcpProvider: source.type === 'mcp_server' ? String(config.provider || '') : null,
  };
}

async function getOrgUser() {
  const user = await getCurrentUser();
  if (!user?.organizationId) return null;
  return user;
}

async function requireDataFeature(projectId: string, organizationId: string, featureKey: Parameters<typeof isProjectFeatureEnabled>[2]) {
  const enabled = await isProjectFeatureEnabled(projectId, organizationId, featureKey);
  if (!enabled) throw new Error(`Feature "${featureKey}" is disabled for this project`);
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!isProjectAgentModuleEnabled()) return NextResponse.json({ error: 'Project Agent module is disabled' }, { status: 404 });

  const user = await getOrgUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { path = [] } = await context.params;
  const [seg1, seg2, seg3] = path;
  const projectId = request.nextUrl.searchParams.get('projectId') || '';

  try {
    if (seg1 === 'status') {
      return NextResponse.json({
        enabled: true,
        runtimeReady: true,
        mode: 'project-scoped',
      });
    }

    if (seg1 === 'projects') {
      const projects = await listProjectAgents(user.organizationId!);
      return NextResponse.json({ projects });
    }

    if (seg1 === 'features') {
      if (!projectId) return badRequest('projectId is required');
      const features = await getProjectAgentFeatures(projectId, user.organizationId!);
      return NextResponse.json({ features });
    }

    if (seg1 === 'settings') {
      if (!projectId) return badRequest('projectId is required');
      const settings = await getProjectAgentSettings(projectId, user.organizationId!);
      return NextResponse.json({ settings });
    }

    if (seg1 === 'sources') {
      if (!projectId) return badRequest('projectId is required');
      const sources = await listProjectDataSources(projectId, user.organizationId!);
      return NextResponse.json({ sources: sources.map(serializeProjectSource) });
    }

    if (seg1 === 'annotations') {
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataAnnotations');
      const [globalNotes, sources] = await Promise.all([
        getProjectAgentGlobalNotes(projectId, user.organizationId!),
        listProjectDataSources(projectId, user.organizationId!),
      ]);
      return NextResponse.json({
        globalNotes,
        sources: sources.map((s: any) => ({
          id: s.id,
          name: s.name,
          userNotes: s.userNotes || '',
          inferredNotes: s.inferredNotes || '',
        })),
      });
    }

    if (seg1 === 'runs') {
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataQueryRuns');
      if (seg2) {
        const run = await getProjectDataQueryRun(projectId, user.organizationId!, seg2);
        if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        return NextResponse.json({ run });
      }
      const limit = Number(request.nextUrl.searchParams.get('limit') || 50);
      const runs = await listProjectDataQueryRuns(projectId, user.organizationId!, limit);
      return NextResponse.json({ runs });
    }

    if (seg1 === 'memory-rules') {
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataMemoryRules');
      const rules = await listProjectMemoryRules(projectId, user.organizationId!);
      return NextResponse.json({ rules });
    }

    if (seg1 === 'workflows') {
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataWorkflows');
      const workflows = await listProjectWorkflows(projectId, user.organizationId!);
      return NextResponse.json({ workflows });
    }

    if (seg1 === 'conversations') {
      if (!projectId) return badRequest('projectId is required');
      if (seg2) {
        const conversation = await getProjectConversation({
          conversationId: seg2,
          projectId,
          organizationId: user.organizationId!,
          userId: user.id,
        });
        if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        return NextResponse.json(conversation);
      }
      const conversations = await listProjectConversations({
        projectId,
        organizationId: user.organizationId!,
        userId: user.id,
        limit: Number(request.nextUrl.searchParams.get('limit') || 100),
      });
      return NextResponse.json({ conversations });
    }

    if (seg1 === 'workflow-runs') {
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataWorkflows');
      if (seg2) {
        const run = await getProjectWorkflowRun(projectId, user.organizationId!, seg2);
        if (!run) return NextResponse.json({ error: 'Workflow run not found' }, { status: 404 });
        return NextResponse.json({ run });
      }
      const workflowId = request.nextUrl.searchParams.get('workflowId') || undefined;
      const limit = Number(request.nextUrl.searchParams.get('limit') || 50);
      const runs = await listProjectWorkflowRuns(projectId, user.organizationId!, workflowId, limit);
      return NextResponse.json({ runs });
    }

    if (seg1 === 'prompts') {
      if (!canAccessPlatformAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const prompts = await getProjectAgentPromptTemplates();
      return NextResponse.json({ prompts });
    }

    return notFound();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Request failed' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!isProjectAgentModuleEnabled()) return NextResponse.json({ error: 'Project Agent module is disabled' }, { status: 404 });
  const user = await getOrgUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { path = [] } = await context.params;
  const [seg1, seg2, seg3] = path;

  try {
    if (seg1 === 'features') {
      const { projectId, dataQueryRuns, dataMemoryRules, dataWorkflows, dataDeepTools, dataAnnotations } = await request.json();
      if (!projectId) return badRequest('projectId is required');
      const patch: Record<string, boolean> = {};
      if (typeof dataQueryRuns === 'boolean') patch.dataQueryRuns = dataQueryRuns;
      if (typeof dataMemoryRules === 'boolean') patch.dataMemoryRules = dataMemoryRules;
      if (typeof dataWorkflows === 'boolean') patch.dataWorkflows = dataWorkflows;
      if (typeof dataDeepTools === 'boolean') patch.dataDeepTools = dataDeepTools;
      if (typeof dataAnnotations === 'boolean') patch.dataAnnotations = dataAnnotations;
      const features = await updateProjectAgentFeatures(projectId, user.organizationId!, patch);
      return NextResponse.json({ features });
    }

    if (seg1 === 'annotations' && seg2 === 'global') {
      const { projectId, globalNotes } = await request.json();
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataAnnotations');
      const saved = await updateProjectAgentGlobalNotes(projectId, user.organizationId!, String(globalNotes || ''));
      return NextResponse.json({ globalNotes: saved });
    }

    if (seg1 === 'sources' && seg2 && seg3 === 'annotations') {
      const { projectId, userNotes } = await request.json();
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataAnnotations');
      const source = await updateProjectSourceNotes({
        projectId,
        organizationId: user.organizationId!,
        sourceId: seg2,
        userNotes: String(userNotes || ''),
      });
      return NextResponse.json({ source });
    }

    if (seg1 === 'memory-rules' && seg2) {
      const { projectId, sourceId, name, ruleText, priority } = await request.json();
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataMemoryRules');
      const rule = await updateProjectMemoryRule({
        projectId,
        organizationId: user.organizationId!,
        ruleId: seg2,
        sourceId,
        name,
        ruleText,
        priority,
      });
      return NextResponse.json({ rule });
    }

    if (seg1 === 'workflows' && seg2) {
      const { projectId, name, description, definition } = await request.json();
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataWorkflows');
      const workflow = await updateProjectWorkflow({
        projectId,
        organizationId: user.organizationId!,
        workflowId: seg2,
        name,
        description,
        definition,
      });
      return NextResponse.json({ workflow });
    }

    if (seg1 === 'prompts') {
      if (!canAccessPlatformAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const body = await request.json();
      const prompts = await updateProjectAgentPromptTemplates(body || {});
      return NextResponse.json({ prompts });
    }

    if (seg1 === 'settings') {
      const { projectId, agentName, defaultModel, instructions } = await request.json();
      if (!projectId) return badRequest('projectId is required');
      const settings = await updateProjectAgentSettings({
        projectId,
        organizationId: user.organizationId!,
        agentName,
        defaultModel,
        instructions,
      });
      return NextResponse.json({ settings });
    }

    return notFound();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Request failed' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!isProjectAgentModuleEnabled()) return NextResponse.json({ error: 'Project Agent module is disabled' }, { status: 404 });
  const user = await getOrgUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { path = [] } = await context.params;
  const [seg1, seg2, seg3] = path;

  try {
    const body = await request.json();
    if (seg1 === 'sources' && seg2 && seg3 === 'status') {
      const { projectId, enabled } = body;
      if (!projectId || typeof enabled !== 'boolean') return badRequest('projectId and enabled are required');
      const result = await setProjectDataSourceEnabled({
        projectId,
        organizationId: user.organizationId!,
        sourceId: seg2,
        enabled,
      });
      return NextResponse.json(result);
    }

    if (seg1 === 'memory-rules' && seg2 && seg3 === 'status') {
      const { projectId, enabled } = body;
      if (!projectId || typeof enabled !== 'boolean') return badRequest('projectId and enabled are required');
      await requireDataFeature(projectId, user.organizationId!, 'dataMemoryRules');
      const rule = await setProjectMemoryRuleEnabled(projectId, user.organizationId!, seg2, enabled);
      return NextResponse.json({ rule });
    }

    if (seg1 === 'workflows' && seg2 && seg3 === 'status') {
      const { projectId, enabled } = body;
      if (!projectId || typeof enabled !== 'boolean') return badRequest('projectId and enabled are required');
      await requireDataFeature(projectId, user.organizationId!, 'dataWorkflows');
      const workflow = await setProjectWorkflowEnabled(projectId, user.organizationId!, seg2, enabled);
      return NextResponse.json({ workflow });
    }

    if (seg1 === 'conversations' && seg2) {
      const { projectId, title, isPinned } = body;
      if (!projectId) return badRequest('projectId is required');
      if (title === undefined && typeof isPinned !== 'boolean') {
        return badRequest('Provide title and/or isPinned');
      }
      const conversation = await updateProjectConversationTitle({
        conversationId: seg2,
        projectId: String(projectId),
        organizationId: user.organizationId!,
        userId: user.id,
        title: title === undefined ? undefined : String(title),
        isPinned: typeof isPinned === 'boolean' ? isPinned : undefined,
      });
      if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      return NextResponse.json({ conversation });
    }

    return notFound();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Request failed' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!isProjectAgentModuleEnabled()) return NextResponse.json({ error: 'Project Agent module is disabled' }, { status: 404 });
  const user = await getOrgUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { path = [] } = await context.params;
  const [seg1, seg2] = path;

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = String(body.projectId || request.nextUrl.searchParams.get('projectId') || '');
    if (!projectId) return badRequest('projectId is required');

    if (seg1 === 'memory-rules' && seg2) {
      await requireDataFeature(projectId, user.organizationId!, 'dataMemoryRules');
      const result = await deleteProjectMemoryRule(projectId, user.organizationId!, seg2);
      return NextResponse.json(result);
    }

    if (seg1 === 'workflows' && seg2) {
      await requireDataFeature(projectId, user.organizationId!, 'dataWorkflows');
      const result = await deleteProjectWorkflow(projectId, user.organizationId!, seg2);
      return NextResponse.json(result);
    }

    if (seg1 === 'conversations' && seg2) {
      const result = await deleteProjectConversation({
        conversationId: seg2,
        projectId,
        organizationId: user.organizationId!,
        userId: user.id,
      });
      if (!result) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      return NextResponse.json(result);
    }

    return notFound();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Request failed' }, { status: 400 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!isProjectAgentModuleEnabled()) return NextResponse.json({ error: 'Project Agent module is disabled' }, { status: 404 });
  const user = await getOrgUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { path = [] } = await context.params;
  const [seg1, seg2, seg3] = path;

  try {
    const body = await request.json().catch(() => ({}));

    if (seg1 === 'chat') {
      const { projectId, sourceId, message } = body as { projectId: string; sourceId?: string; message: string };
      if (!projectId || !message) return badRequest('projectId and message are required');
      try {
        const result = await runProjectAgentChat({
          projectId,
          organizationId: user.organizationId!,
          sourceId,
          message,
        });
        return NextResponse.json(result);
      } catch (chatErr: any) {
        const sourceObj = chatErr?.source && typeof chatErr.source === 'object'
          ? {
              id: String(chatErr.source.id || sourceId || ''),
              name: String(chatErr.source.name || 'Unknown Source'),
              type: String(chatErr.source.type || 'postgres'),
            }
          : {
              id: String(sourceId || ''),
              name: 'Unknown Source',
              type: 'postgres',
            };
        const sqlText = String(chatErr?.sql || '').trim();
        const response: Record<string, unknown> = {
          error: chatErr?.message || 'Project agent chat failed',
          source: sourceObj,
          artifactActions: {
            canSaveTable: false,
            canCreateChart: false,
            canCreateKpi: false,
            canAddToDashboard: false,
            canSaveSql: !!sqlText,
          },
        };
        if (sqlText) {
          response.trust = {
            sql: sqlText,
            rowCount: 0,
            model: 'claude-sonnet-4-20250514',
            confidence:
              Number.isFinite(Number(chatErr?.confidence)) ? Number(chatErr.confidence) : null,
            reasoning: String(chatErr?.reasoning || 'Query failed during execution'),
            sampleRows: [],
          };
          response.querySpecDraft = {
            name: String(message || '').slice(0, 80),
            projectId,
            sourceId: sourceObj.id,
            sqlText,
            metadataJson: {
              rowCount: 0,
              confidence:
                Number.isFinite(Number(chatErr?.confidence)) ? Number(chatErr.confidence) : null,
              reasoning: String(chatErr?.reasoning || 'Query failed during execution'),
              sampleRows: [],
            },
          };
        }
        return NextResponse.json(response, { status: 400 });
      }
    }

    if (seg1 === 'conversations' && !seg2) {
      const { projectId, title } = body as { projectId: string; title?: string };
      if (!projectId) return badRequest('projectId is required');
      const conversation = await createProjectConversation({
        projectId,
        organizationId: user.organizationId!,
        userId: user.id,
        title: String(title || 'New conversation'),
      });
      return NextResponse.json({ conversation });
    }

    if (seg1 === 'conversations' && seg2 && seg3 === 'messages') {
      const { projectId, messages } = body as {
        projectId: string;
        messages: Array<{ role: 'user' | 'assistant'; content: string; dataRunJson?: Record<string, unknown> }>;
      };
      if (!projectId || !Array.isArray(messages)) return badRequest('projectId and messages are required');
      const conversation = await appendProjectConversationMessages({
        conversationId: seg2,
        projectId,
        organizationId: user.organizationId!,
        userId: user.id,
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || ''),
          dataRunJson: m.dataRunJson || null,
        })),
      });
      return NextResponse.json(conversation);
    }

    if (seg1 === 'create') {
      const { projectId, agentName, defaultModel, instructions } = body as {
        projectId: string;
        agentName?: string;
        defaultModel?: string;
        instructions?: string;
      };
      if (!projectId) return badRequest('projectId is required');
      const agent = await createProjectAgent({
        projectId,
        organizationId: user.organizationId!,
        agentName,
        defaultModel,
        instructions,
      });
      return NextResponse.json({ agent });
    }

    if (seg1 === 'deep-tools' && seg2 === 'plan') {
      const { projectId, sourceId, message } = body as { projectId: string; sourceId?: string; message: string };
      if (!projectId || !message) return badRequest('projectId and message are required');
      const plan = await planProjectDeepTool({
        projectId,
        organizationId: user.organizationId!,
        sourceId,
        message,
      });
      return NextResponse.json(plan);
    }

    if (seg1 === 'deep-tools' && seg2 === 'execute') {
      const { projectId, action, payload } = body as { projectId: string; action: any; payload?: Record<string, unknown> };
      if (!projectId || !action) return badRequest('projectId and action are required');
      const result = await executeProjectDeepTool({
        projectId,
        organizationId: user.organizationId!,
        action,
        payload,
      });
      return NextResponse.json(result);
    }

    if (seg1 === 'sources' && seg2 && seg3 === 'test') {
      const { projectId } = body as { projectId: string };
      if (!projectId) return badRequest('projectId is required');
      const result = await testSavedProjectSource({
        projectId,
        organizationId: user.organizationId!,
        sourceId: seg2,
      });
      return NextResponse.json(result);
    }

    if (seg1 === 'sources' && seg2 && seg3 === 'introspect') {
      const { projectId } = body as { projectId: string };
      if (!projectId) return badRequest('projectId is required');
      const result = await introspectSavedProjectSource({
        projectId,
        organizationId: user.organizationId!,
        sourceId: seg2,
      });
      return NextResponse.json(result);
    }

    if (seg1 === 'memory-rules') {
      const { projectId, sourceId, name, ruleText, priority, enabled } = body;
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataMemoryRules');
      const rule = await createProjectMemoryRule({
        projectId,
        organizationId: user.organizationId!,
        sourceId,
        name,
        ruleText,
        priority,
        enabled,
      });
      return NextResponse.json({ rule });
    }

    if (seg1 === 'workflows' && !seg2) {
      const { projectId, name, description, enabled, definition } = body;
      if (!projectId || !name || !definition) return badRequest('projectId, name, and definition are required');
      await requireDataFeature(projectId, user.organizationId!, 'dataWorkflows');
      const workflow = await createProjectWorkflow({
        projectId,
        organizationId: user.organizationId!,
        name,
        description,
        enabled,
        definition,
      });
      return NextResponse.json({ workflow });
    }

    if (seg1 === 'workflows' && seg2 && seg3 === 'run') {
      const { projectId } = body;
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataWorkflows');
      const run = await runProjectWorkflow({
        projectId,
        organizationId: user.organizationId!,
        workflowId: seg2,
        triggeredBy: 'manual',
      });
      return NextResponse.json({ run });
    }

    if (seg1 === 'annotations' && seg2 === 'generate-source') {
      const { projectId, sourceId } = body as { projectId: string; sourceId: string };
      if (!projectId || !sourceId) return badRequest('projectId and sourceId are required');
      await requireDataFeature(projectId, user.organizationId!, 'dataAnnotations');

      const source = await getProjectDataSourceById(projectId, user.organizationId!, sourceId);
      if (!source) return NextResponse.json({ error: 'Data source not found' }, { status: 404 });

      const introspected = await introspectSavedProjectSource({
        projectId,
        organizationId: user.organizationId!,
        sourceId,
      });
      const templates = await getProjectAgentPromptTemplates();
      const filledPrompt = applyTemplate(templates.sourceDraftPrompt, {
        source_name: String(source.name || ''),
        source_type: String(source.type || ''),
        inferred_notes: String(introspected.inferredNotes || ''),
      });

      const provider = getProviderForModel('claude-sonnet-4-20250514');
      const draft = await provider.generate(
        [
          { role: 'system', content: 'You write concise, accurate data source annotation drafts for analysts.' },
          { role: 'user', content: filledPrompt },
        ],
        { model: 'claude-sonnet-4-20250514', agentId: projectId, maxTokens: 900 }
      );

      return NextResponse.json({
        draft: String(draft || '').trim(),
        inferredNotes: introspected.inferredNotes || '',
        promptUsed: filledPrompt,
      });
    }

    if (seg1 === 'annotations' && seg2 === 'generate-cross-source') {
      const { projectId } = body as { projectId: string };
      if (!projectId) return badRequest('projectId is required');
      await requireDataFeature(projectId, user.organizationId!, 'dataAnnotations');

      const sources = await listProjectDataSources(projectId, user.organizationId!);
      const summary = sources.length
        ? sources
            .map((s: any) =>
              [
                `- ${s.name} (${s.type})`,
                s.userNotes ? `  User notes: ${s.userNotes}` : '',
                s.inferredNotes ? `  Inferred notes: ${s.inferredNotes}` : '',
              ]
                .filter(Boolean)
                .join('\n')
            )
            .join('\n')
        : 'No sources connected.';

      const templates = await getProjectAgentPromptTemplates();
      const filledPrompt = applyTemplate(templates.crossSourceDraftPrompt, {
        sources_summary: summary,
      });

      const provider = getProviderForModel('claude-sonnet-4-20250514');
      const draft = await provider.generate(
        [
          { role: 'system', content: 'You write practical cross-source guidance drafts for project data agents.' },
          { role: 'user', content: filledPrompt },
        ],
        { model: 'claude-sonnet-4-20250514', agentId: projectId, maxTokens: 900 }
      );

      return NextResponse.json({
        draft: String(draft || '').trim(),
        promptUsed: filledPrompt,
      });
    }

    return notFound();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Request failed' }, { status: 400 });
  }
}
