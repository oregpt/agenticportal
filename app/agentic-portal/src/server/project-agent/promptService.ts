import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { ensureProjectAgentTables } from './bootstrap';

const DATA_PROMPTS_KEY = 'project_agent_data_prompts';

export interface ProjectAgentPromptTemplates {
  sourceDraftPrompt: string;
  crossSourceDraftPrompt: string;
  tableSelectionPrompt: string;
  phase1IntentPrompt: string;
  phase2PlanPrompt: string;
  phase3ReviewPrompt: string;
  sheetsPlanPrompt: string;
  answerSynthesisPrompt: string;
}

export const DEFAULT_PROJECT_AGENT_PROMPTS: ProjectAgentPromptTemplates = {
  sourceDraftPrompt: [
    'You are helping configure a project data agent.',
    'Write concise, practical source notes for this source so query planning is more accurate.',
    'Focus on business meaning, key columns, caveats, and data quality risks.',
    'Prefer bullets. Keep it specific and operational.',
    '',
    'Source name: {{source_name}}',
    'Source type: {{source_type}}',
    'Inferred schema notes:',
    '{{inferred_notes}}',
    '',
    'Return plain text only.',
  ].join('\n'),
  crossSourceDraftPrompt: [
    'You are helping configure a multi-source project data agent.',
    'Write cross-source guidance that explains schema differences, shared entities, and normalization rules.',
    'Include naming differences, time fields, and source-specific caveats.',
    'Prefer bullets and be concrete.',
    '',
    'Sources:',
    '{{sources_summary}}',
    '',
    'Return plain text only.',
  ].join('\n'),
  tableSelectionPrompt: [
    'Pick the single best table for the user question.',
    'Prefer the table that directly contains the required metric and grain.',
    '',
    'Question:',
    '{{question}}',
    '',
    'Allowed tables:',
    '{{tables}}',
    '',
    'Schema summary:',
    '{{schema}}',
  ].join('\n'),
  phase1IntentPrompt: [
    'Infer intent and candidate columns from schema.',
    'Prioritize business meaning and correct metric/dimension separation.',
    '',
    'Question: {{question}}',
    'Table: {{table_name}}',
    'Source: {{source_name}} ({{source_type}})',
  ].join('\n'),
  phase2PlanPrompt: [
    'Create a structured SQL plan.',
    'Use aggregation/grouping/window patterns when requested by the question.',
    '',
    'Question: {{question}}',
    'Table: {{table_name}}',
    'Intent objective: {{intent_objective}}',
    'Intent type: {{intent_type}}',
  ].join('\n'),
  phase3ReviewPrompt: [
    'Review generated SQL for correctness and faithfulness to user intent.',
    'Check metric semantics, grouping grain, filter correctness, and null/date handling.',
    'Common failure checks: GROUP BY spelling/placement, BigQuery DATE_DIFF (not DATEDIFF), no quoted SQL functions (e.g. DATE_SUB), and no non-scalar division operands.',
    '',
    'Question: {{question}}',
    'Table: {{table_name}}',
  ].join('\n'),
  sheetsPlanPrompt: [
    'Build a structured query plan for spreadsheet data.',
    'Use filters, grouping, aggregation, conditional buckets, and running totals when needed.',
    '',
    'Question: {{question}}',
    'Source: {{source_name}} ({{source_type}})',
    'Available sheets and columns:',
    '{{schema}}',
  ].join('\n'),
  answerSynthesisPrompt: [
    'Answer strictly from the provided query output.',
    'Be concise, quantitative, and explicit about uncertainty.',
    '',
    'Question:',
    '{{question}}',
    '',
    'Source: {{source_name}} ({{source_type}})',
    'Query used:',
    '{{sql}}',
    '',
    'Rows returned: {{row_count}}',
    'Sample rows JSON:',
    '{{sample_rows_json}}',
  ].join('\n'),
};

function normalizePrompts(value: any): ProjectAgentPromptTemplates {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PROJECT_AGENT_PROMPTS };
  return {
    sourceDraftPrompt: typeof value.sourceDraftPrompt === 'string' && value.sourceDraftPrompt.trim()
      ? value.sourceDraftPrompt
      : DEFAULT_PROJECT_AGENT_PROMPTS.sourceDraftPrompt,
    crossSourceDraftPrompt: typeof value.crossSourceDraftPrompt === 'string' && value.crossSourceDraftPrompt.trim()
      ? value.crossSourceDraftPrompt
      : DEFAULT_PROJECT_AGENT_PROMPTS.crossSourceDraftPrompt,
    tableSelectionPrompt: typeof value.tableSelectionPrompt === 'string' && value.tableSelectionPrompt.trim()
      ? value.tableSelectionPrompt
      : DEFAULT_PROJECT_AGENT_PROMPTS.tableSelectionPrompt,
    phase1IntentPrompt: typeof value.phase1IntentPrompt === 'string' && value.phase1IntentPrompt.trim()
      ? value.phase1IntentPrompt
      : DEFAULT_PROJECT_AGENT_PROMPTS.phase1IntentPrompt,
    phase2PlanPrompt: typeof value.phase2PlanPrompt === 'string' && value.phase2PlanPrompt.trim()
      ? value.phase2PlanPrompt
      : DEFAULT_PROJECT_AGENT_PROMPTS.phase2PlanPrompt,
    phase3ReviewPrompt: typeof value.phase3ReviewPrompt === 'string' && value.phase3ReviewPrompt.trim()
      ? value.phase3ReviewPrompt
      : DEFAULT_PROJECT_AGENT_PROMPTS.phase3ReviewPrompt,
    sheetsPlanPrompt: typeof value.sheetsPlanPrompt === 'string' && value.sheetsPlanPrompt.trim()
      ? value.sheetsPlanPrompt
      : DEFAULT_PROJECT_AGENT_PROMPTS.sheetsPlanPrompt,
    answerSynthesisPrompt: typeof value.answerSynthesisPrompt === 'string' && value.answerSynthesisPrompt.trim()
      ? value.answerSynthesisPrompt
      : DEFAULT_PROJECT_AGENT_PROMPTS.answerSynthesisPrompt,
  };
}

export async function getProjectAgentPromptTemplates(): Promise<ProjectAgentPromptTemplates> {
  await ensureProjectAgentTables();
  const rows = await db
    .select()
    .from(schema.platformSettings)
    .where(eq(schema.platformSettings.key, DATA_PROMPTS_KEY))
    .limit(1);
  const row = rows[0] as any;
  if (!row) return { ...DEFAULT_PROJECT_AGENT_PROMPTS };
  return normalizePrompts(row.value);
}

export async function updateProjectAgentPromptTemplates(
  input: Partial<ProjectAgentPromptTemplates>
): Promise<ProjectAgentPromptTemplates> {
  await ensureProjectAgentTables();
  const current = await getProjectAgentPromptTemplates();
  const next = normalizePrompts({
    ...current,
    ...input,
  });

  const existing = await db
    .select()
    .from(schema.platformSettings)
    .where(eq(schema.platformSettings.key, DATA_PROMPTS_KEY))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.platformSettings).values({
      key: DATA_PROMPTS_KEY,
      value: next,
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(schema.platformSettings)
      .set({ value: next, updatedAt: new Date() })
      .where(eq(schema.platformSettings.key, DATA_PROMPTS_KEY));
  }
  return next;
}

export function applyTemplate(template: string, variables: Record<string, string>): string {
  let out = template || '';
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    out = out.replace(pattern, value ?? '');
  }
  return out;
}
