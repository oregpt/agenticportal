import { getProviderForModel } from '@/server/llm';
import { createDataSourceAdapter } from '@/lib/datasources';
import type { DataSourceConfig, QueryResult } from '@/lib/datasources';
import { NL2SQLPlannerService, inferFieldType, type PlannerField, type PlannerSchemaContext } from './plannerService';
import { applyTemplate, getProjectAgentPromptTemplates } from './promptService';
import { getProjectAgentFeatures, getProjectAgentGlobalNotes } from './projectAgentService';
import { createProjectDataQueryRun } from './queryRunService';
import { listEnabledProjectMemoryRulesForChat } from './memoryRuleService';
import { getProjectDataSourceById, listProjectDataSources } from './sourceService';
import type { ProjectAgentDataSource } from './types';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function sanitizeSql(sql: string): string {
  let cleaned = sql.trim().replace(/```sql|```/gi, '').trim();
  cleaned = cleaned.replace(/;+$/g, '').trim();
  const lowered = cleaned.toLowerCase();
  if (!lowered) throw new Error('Generated SQL was empty');
  if (!lowered.startsWith('select') && !lowered.startsWith('with')) {
    throw new Error('Only read-only SELECT queries are allowed');
  }
  if (/(insert|update|delete|drop|alter|truncate|create|grant|revoke)\s+/i.test(lowered)) {
    throw new Error('Unsafe SQL statement detected');
  }
  return cleaned;
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error('Model did not return valid JSON');
}

function userRequestedLimit(message: string): boolean {
  const text = String(message || '').toLowerCase();
  if (!text) return false;
  if (/\b(top|first|last)\s+\d+\b/.test(text)) return true;
  if (/\blimit\s+\d+\b/.test(text)) return true;
  if (/\b(show|list|return|give)\s+(me\s+)?\d+\s+(rows|records|transactions|items|results)\b/.test(text)) return true;
  if (/\bpreview\b/.test(text)) return true;
  return false;
}

function getPlannerSourceType(type: ProjectAgentDataSource['type']): PlannerSchemaContext['sourceType'] {
  if (type === 'google_sheets_live') return 'bigquery';
  return type;
}

function getGoogleSheetsTableFqn(source: ProjectAgentDataSource): string | null {
  if (source.type !== 'google_sheets_live') return null;
  const config = (source.config || {}) as Record<string, unknown>;
  const configuredFqn = String(config.externalTableFQN || '').trim();
  if (configuredFqn) return configuredFqn;

  const projectId = String(config.bqProjectId || '').trim();
  const dataset = String(config.bqDataset || '').trim();
  const table = String(config.bqTableName || '').trim();
  if (projectId && dataset && table) {
    return `${projectId}.${dataset}.${table}`;
  }
  return null;
}

function schemaFromSource(source: ProjectAgentDataSource) {
  const schemaFieldsByTable: Record<string, PlannerField[]> = {};
  const schemaTables: string[] = [];
  const schemaTextParts: string[] = [];
  const sheetsTableFqn = getGoogleSheetsTableFqn(source);

  const schemaCache = source.schemaCache as any;
  const tables = Array.isArray(schemaCache?.tables) ? schemaCache.tables : [];

  for (const table of tables.slice(0, 80)) {
    const tableName = source.type === 'google_sheets_live'
      ? String(sheetsTableFqn || table?.name || '').trim()
      : String(table?.name || '').trim();
    if (!tableName) continue;
    const columns = Array.isArray(table?.columns) ? table.columns : [];
    const fields: PlannerField[] = columns
      .map((c: any) => ({
        column: String(c?.name || ''),
        type: inferFieldType(String(c?.type || 'string')),
        nullable: c?.nullable !== false,
        description: typeof c?.description === 'string' ? c.description : '',
      }))
      .filter((f: PlannerField) => !!f.column);
    if (!fields.length) continue;
    schemaTables.push(tableName);
    schemaFieldsByTable[tableName] = fields;
    schemaTextParts.push(`${tableName}(${fields.slice(0, 30).map((f) => `${f.column}:${f.type}`).join(', ')})`);
  }

  return {
    schemaTables,
    schemaFieldsByTable,
    schemaText: schemaTextParts.join('\n'),
  };
}

async function runWithAdapter(source: ProjectAgentDataSource, sqlText: string): Promise<{ rows: any[]; rowCount: number }> {
  const adapter = await createDataSourceAdapter({
    id: source.id,
    organizationId: source.organizationId,
    name: source.name,
    type: source.type,
    createdAt: source.updatedAt,
    updatedAt: source.updatedAt,
    createdBy: 'project-agent',
    ...(source.config || {}),
  } as DataSourceConfig);

  try {
    const result: QueryResult = await adapter.executeQuery(sqlText);
    return { rows: result.rows || [], rowCount: result.rowCount || (result.rows || []).length };
  } finally {
    await adapter.disconnect().catch(() => {});
  }
}

export async function runProjectAgentChat(input: {
  projectId: string;
  organizationId: string;
  message: string;
  sourceId?: string;
  workflowId?: string;
  workflowRunId?: string;
}) {
  const message = String(input.message || '').trim();
  if (!message) throw new Error('message is required');

  const features = await getProjectAgentFeatures(input.projectId, input.organizationId);
  const allSources = await listProjectDataSources(input.projectId, input.organizationId);
  const enabledSources = allSources.filter((s) => s.status !== 'disabled');
  if (!enabledSources.length) throw new Error('No active data source found for this project');

  let source: ProjectAgentDataSource;
  if (input.sourceId) {
    const selected = await getProjectDataSourceById(input.projectId, input.organizationId, input.sourceId);
    if (!selected) throw new Error('Data source not found');
    if (selected.status === 'disabled') throw new Error('Selected data source is disabled');
    source = selected;
  } else {
    source = enabledSources[0]!;
  }

  const model = DEFAULT_MODEL;
  const provider = getProviderForModel(model);
  const promptTemplates = await getProjectAgentPromptTemplates();
  const memoryRules = features.dataMemoryRules
    ? await listEnabledProjectMemoryRulesForChat(input.projectId, input.organizationId, source.id)
    : [];
  const globalNotes = features.dataAnnotations ? await getProjectAgentGlobalNotes(input.projectId, input.organizationId) : '';
  const sourceUserNotes = features.dataAnnotations ? String(source.userNotes || '').trim() : '';
  const sourceInferredNotes = features.dataAnnotations ? String(source.inferredNotes || '').trim() : '';

  const schemaPack = schemaFromSource(source);
  if (!schemaPack.schemaTables.length) {
    throw new Error('No introspected columns available for source. Run source introspection first.');
  }

  const plannerSourceType = getPlannerSourceType(source.type);

  async function selectBestTable(extraContext?: string): Promise<{ tableName: string; reasoning: string; confidence: number | null }> {
    if (schemaPack.schemaTables.length <= 1) {
      const single = schemaPack.schemaTables[0] || source.name;
      return { tableName: single, reasoning: 'Single table available for source.', confidence: 1 };
    }
    const tablePickPrompt = [
      'Return strict JSON only.',
      'Pick the single best table for this query from the allowed list.',
      applyTemplate(promptTemplates.tableSelectionPrompt, {
        question: message,
        tables: schemaPack.schemaTables.join('\n'),
        schema: schemaPack.schemaText || 'Schema unavailable',
      }),
      `Allowed tables:\n${schemaPack.schemaTables.join('\n')}`,
      schemaPack.schemaText ? `Schema:\n${schemaPack.schemaText}` : '',
      extraContext ? `Extra context:\n${extraContext}` : '',
      'JSON: {"table":"...","reasoning":"...","confidence":0.0}',
    ].filter(Boolean).join('\n\n');
    const raw = await provider.generate(
      [
        { role: 'system', content: 'You select the best table for a SQL query and return strict JSON only.' },
        { role: 'user', content: tablePickPrompt },
      ],
      { model, agentId: input.projectId, maxTokens: 700 }
    );
    const parsed = extractJson(raw);
    const picked = String(parsed.table || '').trim();
    const tableName = schemaPack.schemaTables.includes(picked)
      ? picked
      : schemaPack.schemaTables.find((t) => t.endsWith(`.${picked}`) || t === picked) || schemaPack.schemaTables[0];
    const resolvedTable = tableName || source.name || '';
    if (!resolvedTable) throw new Error('Could not resolve a table from schema');
    return {
      tableName: resolvedTable,
      reasoning: String(parsed.reasoning || 'Table selected from available schema'),
      confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : null,
    };
  }

  async function planAndExecute(extraContext?: string): Promise<{
    result: { rows: any[]; rowCount: number };
    sql: string;
    reasoning: string;
    confidence: number | null;
  }> {
    const tablePick = await selectBestTable(extraContext);
    const fieldsForTable = schemaPack.schemaFieldsByTable[tablePick.tableName] || [];
    if (!fieldsForTable.length) throw new Error('No introspected columns available for selected table');
    const planner = new NL2SQLPlannerService(provider, model, input.projectId);

    const plannerGuidance = [
      `Table selection prompt guidance:\n${applyTemplate(promptTemplates.tableSelectionPrompt, {
        question: message,
        tables: schemaPack.schemaTables.join('\n'),
        schema: schemaPack.schemaText || 'Schema unavailable',
      })}`,
      `Phase 1 intent prompt guidance:\n${applyTemplate(promptTemplates.phase1IntentPrompt, {
        question: message,
        source_name: source.name,
        source_type: plannerSourceType,
        table_name: tablePick.tableName,
      })}`,
      `Phase 2 plan prompt guidance:\n${applyTemplate(promptTemplates.phase2PlanPrompt, {
        question: message,
        source_name: source.name,
        source_type: plannerSourceType,
        table_name: tablePick.tableName,
        intent_objective: '',
        intent_type: '',
      })}`,
      `Phase 3 review prompt guidance:\n${applyTemplate(promptTemplates.phase3ReviewPrompt, {
        question: message,
        source_name: source.name,
        source_type: plannerSourceType,
        table_name: tablePick.tableName,
      })}`,
      memoryRules.length
        ? `Data memory rules:\n${memoryRules.map((rule: any) => `- [${rule.name}] ${rule.ruleText}`).join('\n')}`
        : '',
      globalNotes ? `Cross-source guidance:\n${globalNotes}` : '',
      sourceUserNotes ? `Source notes (user-provided):\n${sourceUserNotes}` : '',
      sourceInferredNotes ? `Source notes (introspection draft):\n${sourceInferredNotes}` : '',
      extraContext || '',
    ].filter(Boolean).join('\n\n');

    const plannerSchema: PlannerSchemaContext = {
      sourceType: plannerSourceType,
      sourceName: source.name,
      tableName: tablePick.tableName,
      fields: fieldsForTable,
    };

    const phase1 = await planner.phase1({
      query: message,
      schema: plannerSchema,
      extraGuidance: plannerGuidance,
    });

    const phase2PromptGuidance = applyTemplate(promptTemplates.phase2PlanPrompt, {
      question: message,
      source_name: source.name,
      source_type: plannerSourceType,
      table_name: tablePick.tableName,
      intent_objective: phase1.intent.objective,
      intent_type: phase1.intent.queryType,
    });
    let phase2 = await planner.phase2({
      query: message,
      schema: plannerSchema,
      phase1,
      extraGuidance: [plannerGuidance, `Phase 2 template:\n${phase2PromptGuidance}`].filter(Boolean).join('\n\n'),
    });
    if (!userRequestedLimit(message)) phase2.limit = null;

    let safety = planner.validateSafety({ schema: plannerSchema, plan: phase2 });
    if (safety.issues.length > 0) {
      phase2 = await planner.phase2({
        query: message,
        schema: plannerSchema,
        phase1,
        extraGuidance: [plannerGuidance, `Phase 2 template:\n${phase2PromptGuidance}`].filter(Boolean).join('\n\n'),
        executionError: `Safety issues: ${safety.issues.join(' | ')}`,
      });
      if (!userRequestedLimit(message)) phase2.limit = null;
      safety = planner.validateSafety({ schema: plannerSchema, plan: phase2 });
    }

    let sql = planner.generateSQL({ schema: plannerSchema, plan: phase2, safety });
    const phase3 = await planner.phase3({
      query: message,
      schema: plannerSchema,
      sql,
      extraGuidance: [
        plannerGuidance,
        `Phase 3 template:\n${applyTemplate(promptTemplates.phase3ReviewPrompt, {
          question: message,
          source_name: source.name,
          source_type: plannerSourceType,
          table_name: tablePick.tableName,
        })}`,
      ].join('\n\n'),
    });
    if (phase3.correctedSQL && phase3.correctedSQL.trim()) sql = phase3.correctedSQL.trim();

    const finalSql = sanitizeSql(sql);
    const result = await runWithAdapter(source, finalSql);
    const confidence = phase3.confidence ?? tablePick.confidence ?? null;
    const reasoning = [
      `Table selection: ${tablePick.tableName}`,
      `Table selection rationale: ${tablePick.reasoning}`,
      `Phase1 intent: ${phase1.intent.objective} (${phase1.intent.queryType})`,
      `Phase2 rationale: ${phase2.rationale || 'n/a'}`,
      safety.warnings.length ? `Safety warnings: ${safety.warnings.join(' | ')}` : '',
      phase3.issues.length ? `Phase3 issues: ${phase3.issues.join(' | ')}` : '',
      `Phase3 review: ${phase3.explanation || (phase3.approved ? 'approved' : 'needs revision')}`,
    ].filter(Boolean).join('\n');

    return { result, sql: finalSql, reasoning, confidence };
  }

  let queryResult: { rows: any[]; rowCount: number };
  let sqlForTrust = '';
  let reasoningForTrust = '';
  let confidenceForTrust: number | null = null;

  let planned = await planAndExecute();
  try {
    queryResult = planned.result;
    sqlForTrust = planned.sql;
    reasoningForTrust = planned.reasoning;
    confidenceForTrust = planned.confidence;
  } catch (firstErr: any) {
    const repairHint = [
      'Previous SQL failed to execute. Repair the plan and regenerate SQL with strict schema adherence.',
      `Execution error: ${firstErr?.message || 'unknown'}`,
    ].join('\n');
    planned = await planAndExecute(repairHint);
    queryResult = planned.result;
    sqlForTrust = planned.sql;
    reasoningForTrust = planned.reasoning;
    confidenceForTrust = planned.confidence;
  }

  const sampleRows = queryResult.rows.slice(0, 50);
  const rowsJson = JSON.stringify(sampleRows);
  const answerPrompt = applyTemplate(promptTemplates.answerSynthesisPrompt, {
    question: message,
    source_name: source.name,
    source_type: source.type,
    sql: sqlForTrust,
    row_count: String(queryResult.rowCount),
    sample_rows_json: rowsJson,
  });

  const answerText = await provider.generate(
    [
      {
        role: 'system',
        content: 'You are a data analyst. Answer only from the supplied query result. Be concise and explicit about uncertainty.',
      },
      {
        role: 'user',
        content: answerPrompt,
      },
    ],
    { model, agentId: input.projectId, maxTokens: 1200 }
  );

  let runId: string | null = null;
  if (features.dataQueryRuns) {
    runId = await createProjectDataQueryRun({
      projectId: input.projectId,
      organizationId: input.organizationId,
      sourceId: source.id,
      message,
      sqlText: sqlForTrust,
      rowCount: queryResult.rowCount,
      confidence: confidenceForTrust,
      reasoning: reasoningForTrust,
      answer: answerText.trim(),
      resultSample: sampleRows,
      runType: input.workflowRunId ? 'workflow' : 'chat',
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
    });
  }

  return {
    projectId: input.projectId,
    runId,
    source: {
      id: source.id,
      name: source.name,
      type: source.type,
    },
    answer: answerText.trim(),
    artifactActions: {
      canSaveTable: true,
      canCreateChart: true,
      canAddToDashboard: true,
      canSaveSql: true,
    },
    querySpecDraft: {
      name: message.slice(0, 80),
      projectId: input.projectId,
      sourceId: source.id,
      sqlText: sqlForTrust,
      metadataJson: {
        rowCount: queryResult.rowCount,
        confidence: confidenceForTrust,
        reasoning: reasoningForTrust,
      },
    },
    trust: {
      sql: sqlForTrust,
      rowCount: queryResult.rowCount,
      sampleRows,
      model,
      reasoning: reasoningForTrust,
      confidence: confidenceForTrust,
    },
  };
}
