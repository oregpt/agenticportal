import { createProjectMemoryRule, listProjectMemoryRules } from './memoryRuleService';
import { createProjectWorkflow, listProjectWorkflowRuns, listProjectWorkflows } from './workflowService';
import { getProjectAgentFeatures } from './projectAgentService';

type DeepToolAction =
  | 'create_workflow'
  | 'create_memory_rule'
  | 'list_workflows'
  | 'list_memory_rules'
  | 'list_workflow_runs'
  | 'none';

interface DeepToolPlan {
  mode: 'none' | 'confirm' | 'read';
  action: DeepToolAction;
  summary?: string;
  requiresConfirmation?: boolean;
  payload?: Record<string, unknown>;
  message?: string;
}

function parseWorkflowName(message: string): string {
  const quoted = message.match(/"([^"]+)"/);
  if (quoted?.[1]) return quoted[1];
  return 'Workflow from Chat';
}

function parseMemoryRuleName(message: string): string {
  const quoted = message.match(/"([^"]+)"/);
  if (quoted?.[1]) return quoted[1];
  return 'Memory Rule from Chat';
}

function parseWorkflowSteps(message: string): Array<{ message: string }> {
  const cleaned = message.replace(/create workflow/gi, '').replace(/workflow/gi, '').trim();
  const parts = cleaned
    .split(/\bthen\b|->|\n/gi)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!parts.length) return [{ message: 'Summarize key metrics for this data source.' }];
  return parts.map((entry) => ({ message: entry }));
}

export async function planProjectDeepTool(input: {
  projectId: string;
  organizationId: string;
  message: string;
  sourceId?: string;
}): Promise<DeepToolPlan> {
  const features = await getProjectAgentFeatures(input.projectId, input.organizationId);
  if (!features.dataDeepTools) {
    return {
      mode: 'none',
      action: 'none',
      message: 'Project Deep Tools is disabled for this project.',
    };
  }

  const msg = input.message.trim();
  const lower = msg.toLowerCase();

  if (lower.startsWith('list workflows') || lower.startsWith('show workflows')) {
    if (!features.dataWorkflows) return { mode: 'none', action: 'none', message: 'Workflows feature is disabled.' };
    return { mode: 'read', action: 'list_workflows' };
  }

  if (lower.startsWith('list workflow runs') || lower.startsWith('show workflow runs')) {
    if (!features.dataWorkflows) return { mode: 'none', action: 'none', message: 'Workflows feature is disabled.' };
    return { mode: 'read', action: 'list_workflow_runs' };
  }

  if (lower.startsWith('list memory rules') || lower.startsWith('show memory rules')) {
    if (!features.dataMemoryRules) return { mode: 'none', action: 'none', message: 'Memory Rules feature is disabled.' };
    return { mode: 'read', action: 'list_memory_rules' };
  }

  if (lower.startsWith('create workflow')) {
    if (!features.dataWorkflows) return { mode: 'none', action: 'none', message: 'Workflows feature is disabled.' };
    const name = parseWorkflowName(msg);
    const steps = parseWorkflowSteps(msg);
    return {
      mode: 'confirm',
      action: 'create_workflow',
      summary: `Create workflow "${name}" with ${steps.length} step(s).`,
      requiresConfirmation: true,
      payload: {
        name,
        description: 'Created from project data chat via deep tools',
        definition: { steps: steps.map((step) => ({ ...step, sourceId: input.sourceId })) },
      },
    };
  }

  if (lower.startsWith('create memory rule')) {
    if (!features.dataMemoryRules) return { mode: 'none', action: 'none', message: 'Memory Rules feature is disabled.' };
    const name = parseMemoryRuleName(msg);
    const text =
      msg.replace(/create memory rule/gi, '').replace(/"([^"]+)"/, '').trim() ||
      'Always keep outputs concise and include source context.';
    return {
      mode: 'confirm',
      action: 'create_memory_rule',
      summary: `Create memory rule "${name}".`,
      requiresConfirmation: true,
      payload: {
        name,
        ruleText: text,
        priority: 100,
        sourceId: input.sourceId || null,
      },
    };
  }

  return { mode: 'none', action: 'none' };
}

export async function executeProjectDeepTool(input: {
  projectId: string;
  organizationId: string;
  action: DeepToolAction;
  payload?: Record<string, unknown>;
}) {
  const features = await getProjectAgentFeatures(input.projectId, input.organizationId);
  if (!features.dataDeepTools) throw new Error('Project Deep Tools is disabled for this project');

  if (input.action === 'create_workflow') {
    if (!features.dataWorkflows) throw new Error('Workflows feature is disabled');
    const created = await createProjectWorkflow({
      projectId: input.projectId,
      organizationId: input.organizationId,
      name: String(input.payload?.name || 'Workflow from Chat'),
      description: input.payload?.description ? String(input.payload.description) : undefined,
      definition: (input.payload?.definition as any) || { steps: [{ message: 'Summarize key metrics.' }] },
    });
    if (!created) throw new Error('Failed to create workflow');
    return { action: input.action, result: created, message: `Workflow "${created.name}" created.` };
  }

  if (input.action === 'create_memory_rule') {
    if (!features.dataMemoryRules) throw new Error('Memory Rules feature is disabled');
    const created = await createProjectMemoryRule({
      projectId: input.projectId,
      organizationId: input.organizationId,
      name: String(input.payload?.name || 'Memory Rule from Chat'),
      ruleText: String(input.payload?.ruleText || 'Always provide concise output.'),
      priority: Number(input.payload?.priority || 100),
      sourceId: input.payload?.sourceId ? String(input.payload.sourceId) : undefined,
    });
    if (!created) throw new Error('Failed to create memory rule');
    return { action: input.action, result: created, message: `Memory rule "${created.name}" created.` };
  }

  if (input.action === 'list_workflows') {
    if (!features.dataWorkflows) throw new Error('Workflows feature is disabled');
    const items = await listProjectWorkflows(input.projectId, input.organizationId);
    return {
      action: input.action,
      result: items,
      message: items.length
        ? items.map((w: any, idx: number) => `${idx + 1}. ${w.name} (${w.enabled === 1 ? 'enabled' : 'disabled'})`).join('\n')
        : 'No workflows found.',
    };
  }

  if (input.action === 'list_memory_rules') {
    if (!features.dataMemoryRules) throw new Error('Memory Rules feature is disabled');
    const items = await listProjectMemoryRules(input.projectId, input.organizationId);
    return {
      action: input.action,
      result: items,
      message: items.length
        ? items
            .map((r: any, idx: number) => `${idx + 1}. ${r.name} (priority ${r.priority}, ${r.enabled === 1 ? 'enabled' : 'disabled'})`)
            .join('\n')
        : 'No memory rules found.',
    };
  }

  if (input.action === 'list_workflow_runs') {
    if (!features.dataWorkflows) throw new Error('Workflows feature is disabled');
    const items = await listProjectWorkflowRuns(input.projectId, input.organizationId, undefined, 20);
    return {
      action: input.action,
      result: items,
      message: items.length
        ? items
            .map((r: any, idx: number) => `${idx + 1}. ${r.workflowId} | ${r.status} | ${new Date(r.startedAt).toLocaleString()}`)
            .join('\n')
        : 'No workflow runs found.',
    };
  }

  if (input.action === 'none') {
    return { action: input.action, result: null, message: 'No deep tool action selected.' };
  }

  throw new Error('Unsupported deep tool action');
}
