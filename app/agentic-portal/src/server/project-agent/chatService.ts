import { getProviderForModel } from '@/server/llm';
import { createDataSourceAdapter } from '@/lib/datasources';
import type { DataSourceConfig, QueryResult } from '@/lib/datasources';
import type { LLMMessage, Tool } from '@/server/llm/types';
import { NL2SQLPlannerService, inferFieldType, type PlannerField, type PlannerSchemaContext } from './plannerService';
import { applyTemplate, getProjectAgentPromptTemplates } from './promptService';
import { getProjectAgentFeatures, getProjectAgentGlobalNotes } from './projectAgentService';
import { createProjectDataQueryRun } from './queryRunService';
import { listEnabledProjectMemoryRulesForChat } from './memoryRuleService';
import { getProjectDataSourceById, listProjectDataSources } from './sourceService';
import type { ProjectAgentDataSource } from './types';
import { getPortalMcpOrchestrator } from '@/server/mcp/runtime';
import { getMcpProviderDefinition, isMcpProviderId } from '@/server/mcp/providers';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

class ProjectAgentChatExecutionError extends Error {
  sql?: string;
  source?: { id: string; name: string; type: ProjectAgentDataSource['type'] };
  reasoning?: string;
  confidence?: number | null;
  constructor(
    message: string,
    context?: {
      sql?: string;
      source?: { id: string; name: string; type: ProjectAgentDataSource['type'] };
      reasoning?: string;
      confidence?: number | null;
    }
  ) {
    super(message);
    this.name = 'ProjectAgentChatExecutionError';
    this.sql = context?.sql;
    this.source = context?.source;
    this.reasoning = context?.reasoning;
    this.confidence = context?.confidence ?? null;
  }
}

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

function isTransientExecutionError(message: string): boolean {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('502') ||
    text.includes('503') ||
    text.includes('504') ||
    text.includes('bad gateway') ||
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('socket') ||
    text.includes('econnreset') ||
    text.includes('timed out') ||
    text.includes('etimedout')
  );
}

function normalizeSqlForDialect(sourceType: ProjectAgentDataSource['type'], sql: string): string {
  let normalized = String(sql || '');
  normalized = normalized.replace(/\bGROBY\b/gi, 'GROUP BY');
  normalized = normalized.replace(/\bGROB\b/gi, 'GROUP BY');
  normalized = normalized.replace(/'(\s*DATE_SUB\([^']+\))'/gi, '$1');

  if (sourceType === 'bigquery' || sourceType === 'google_sheets_live') {
    normalized = normalized.replace(/\bDATEDIFF\s*\(/gi, 'DATE_DIFF(');
  }

  return normalized;
}

function buildPreflightSql(sql: string): string {
  return `SELECT * FROM (${sql}) AS __preflight LIMIT 0`;
}

function buildRepairHint(message: string, sqlText?: string): string {
  const error = String(message || '');
  const hints: string[] = [
    'Repair the SQL using only schema-valid columns and read-only SELECT/WITH statements.',
    'Return plan fields that generate syntactically valid SQL for the current dialect.',
  ];
  const lower = error.toLowerCase();
  if (lower.includes('only read-only select queries are allowed')) {
    hints.push('Ensure final SQL starts with SELECT or WITH and contains no markdown, prose, or DML/DDL keywords.');
  }
  if (lower.includes('datediff')) {
    hints.push('For BigQuery use DATE_DIFF(end_date, start_date, DAY), never DATEDIFF().');
  }
  if (lower.includes('could not cast literal "date_sub')) {
    hints.push('Never quote SQL functions. Use DATE_SUB(...) as expression, not as string literal.');
  }
  if (lower.includes('neither grouped nor aggregated')) {
    hints.push('Every non-aggregated selected column must be included in GROUP BY.');
  }
  if (lower.includes('no matching signature for operator /')) {
    hints.push('Do not divide by structs/records. Divide only scalar numeric expressions.');
  }
  if (lower.includes('syntax error') || lower.includes('groby') || lower.includes('grob')) {
    hints.push('Fix SQL keyword spelling and structure, especially GROUP BY/ORDER BY clauses.');
  }
  if (isTransientExecutionError(lower)) {
    hints.push('Transient execution failure detected; keep logic stable and avoid unnecessary complexity.');
  }
  if (sqlText) {
    hints.push(`Last attempted SQL:\n${sqlText}`);
  }
  return hints.join('\n');
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

async function runWithAdapterRetry(
  source: ProjectAgentDataSource,
  sqlText: string,
  maxAttempts = 2
): Promise<{ rows: any[]; rowCount: number }> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runWithAdapter(source, sqlText);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= maxAttempts || !isTransientExecutionError(message)) {
        throw error;
      }
      const delay = 400 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Query execution failed');
}

function getMcpProviderId(source: ProjectAgentDataSource): string {
  const config = (source.config || {}) as Record<string, unknown>;
  return String(config.provider || '').trim();
}

async function runProjectAgentMcpChat(input: {
  projectId: string;
  organizationId: string;
  source: ProjectAgentDataSource;
  message: string;
  model: string;
  memoryRulesText: string;
  globalNotesText: string;
  sourceNotesText: string;
}) {
  const providerId = getMcpProviderId(input.source);
  if (!isMcpProviderId(providerId)) {
    throw new Error('Unsupported MCP provider configured for selected source');
  }
  const providerDef = getMcpProviderDefinition(providerId);
  if (!providerDef) throw new Error('MCP provider metadata is unavailable');

  const llm = getProviderForModel(input.model);
  const orchestrator = await getPortalMcpOrchestrator();
  const server = orchestrator.serverRegistry.getServer(providerDef.serverName);
  if (!server) throw new Error(`MCP server "${providerDef.serverName}" is not registered`);
  const serverTools = await server.listTools();
  if (!serverTools.length) throw new Error('No MCP tools available for selected source');

  const tool: Tool = {
    name: `mcp__${providerDef.serverName}`,
    description: `[MCP: ${providerDef.name}] Execute one action from this source.`,
    serverName: providerDef.serverName,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: `Action name for ${providerDef.name}`,
          enum: serverTools.map((t) => t.name),
        },
        params: {
          type: 'object',
          description: 'Action parameters object',
        },
      },
      required: ['action'],
    },
  };

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        'You are a project data agent using MCP tools.',
        `Selected source: ${input.source.name} (${providerDef.name})`,
        'Use only available tool actions. Prefer read/list actions unless user asks for a mutation.',
        input.memoryRulesText,
        input.globalNotesText,
        input.sourceNotesText,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
    { role: 'user', content: input.message },
  ];

  const toolsUsed: string[] = [];
  let finalText = '';
  for (let i = 0; i < 8; i += 1) {
    const generated = await llm.generateWithTools(messages, {
      model: input.model,
      agentId: input.projectId,
      maxTokens: 1600,
      tools: [tool],
    });

    if (generated.type === 'text') {
      finalText = String(generated.text || '').trim();
      break;
    }

    const toolCalls = generated.toolCalls || [];
    if (!toolCalls.length) {
      finalText = String(generated.text || '').trim();
      break;
    }

    messages.push({
      role: 'assistant',
      content: generated.text || '',
      toolCalls,
    });

    for (const toolCall of toolCalls) {
      const serverName = toolCall.name.replace(/^mcp__/, '');
      const action = String(toolCall.input?.action || '').trim();
      const params = (toolCall.input?.params || {}) as Record<string, unknown>;
      if (!action) {
        messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          content: JSON.stringify({ success: false, error: 'Missing action' }),
        });
        continue;
      }

      const result = await orchestrator.executeAction(serverName, action, params, {
        sourceId: input.source.id,
        organizationId: input.organizationId,
        projectId: input.projectId,
      });
      toolsUsed.push(`${serverName}.${action}`);
      messages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (!finalText) {
    finalText = 'Completed MCP tool execution. Review run details for output payloads.';
  }

  const reasoning = toolsUsed.length
    ? `MCP provider: ${providerDef.name}\nTools used:\n${toolsUsed.map((name) => `- ${name}`).join('\n')}`
    : `MCP provider: ${providerDef.name}\nNo MCP tools were executed.`;

  return {
    answer: finalText,
    sqlText: `MCP::${providerDef.serverName}::${toolsUsed.join(',') || 'none'}`,
    rowCount: toolsUsed.length,
    sampleRows: toolsUsed.map((toolName) => ({ tool: toolName })),
    reasoning,
    confidence: toolsUsed.length ? 0.9 : 0.5,
  };
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

  if (source.type === 'mcp_server') {
    const memoryRulesText = memoryRules.length
      ? `Memory rules:\n${memoryRules.map((rule: any) => `- [${rule.name}] ${rule.ruleText}`).join('\n')}`
      : '';
    const globalNotesText = globalNotes ? `Cross-source guidance:\n${globalNotes}` : '';
    const sourceNotesText = [
      sourceUserNotes ? `Source notes:\n${sourceUserNotes}` : '',
      sourceInferredNotes ? `Inferred notes:\n${sourceInferredNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const mcpResult = await runProjectAgentMcpChat({
      projectId: input.projectId,
      organizationId: input.organizationId,
      source,
      message,
      model,
      memoryRulesText,
      globalNotesText,
      sourceNotesText,
    });

    let runId: string | null = null;
    if (features.dataQueryRuns) {
      runId = await createProjectDataQueryRun({
        projectId: input.projectId,
        organizationId: input.organizationId,
        sourceId: source.id,
        message,
        sqlText: mcpResult.sqlText,
        rowCount: mcpResult.rowCount,
        confidence: mcpResult.confidence,
        reasoning: mcpResult.reasoning,
        answer: mcpResult.answer,
        resultSample: mcpResult.sampleRows,
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
      answer: mcpResult.answer,
      artifactActions: {
        canSaveTable: false,
        canCreateChart: false,
        canCreateKpi: false,
        canAddToDashboard: false,
        canSaveSql: false,
      },
      querySpecDraft: null,
      trust: {
        sql: mcpResult.sqlText,
        rowCount: mcpResult.rowCount,
        sampleRows: mcpResult.sampleRows,
        model,
        reasoning: mcpResult.reasoning,
        confidence: mcpResult.confidence,
      },
    };
  }

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
    const phase3CommonChecks = [
      'Phase3 mandatory checks:',
      '- Validate SQL keywords and syntax; reject malformed tokens like GROBY/GROB.',
      '- For BigQuery dialect use DATE_DIFF(...), never DATEDIFF(...).',
      '- Never quote SQL function expressions (e.g. DATE_SUB(...) must not be in quotes).',
      '- All non-aggregated SELECT columns must appear in GROUP BY when aggregating.',
      '- Division operands must be scalar numeric expressions only.',
      '- Output only SELECT/WITH read-only SQL.',
    ].join('\n');
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
    let normalized = planner.normalizePlan({ schema: plannerSchema, plan: phase2 });
    phase2 = normalized.plan;

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
      normalized = planner.normalizePlan({ schema: plannerSchema, plan: phase2 });
      phase2 = normalized.plan;
      safety = planner.validateSafety({ schema: plannerSchema, plan: phase2 });
    }

    let sql = planner.generateSQL({ schema: plannerSchema, plan: phase2, safety });
    let phase3 = await planner.phase3({
      query: message,
      schema: plannerSchema,
      sql,
      extraGuidance: [
        plannerGuidance,
        phase3CommonChecks,
        `Phase 3 template:\n${applyTemplate(promptTemplates.phase3ReviewPrompt, {
          question: message,
          source_name: source.name,
          source_type: plannerSourceType,
          table_name: tablePick.tableName,
        })}`,
      ].join('\n\n'),
    });

    // Phase 3 is advisory only. If review fails, regenerate the plan deterministically.
    if (!phase3.approved || phase3.issues.length > 0) {
      const reviewIssues = [...phase3.issues, ...phase3.fixes].filter(Boolean).join(' | ');
      phase2 = await planner.phase2({
        query: message,
        schema: plannerSchema,
        phase1,
        extraGuidance: [plannerGuidance, `Phase 2 template:\n${phase2PromptGuidance}`].filter(Boolean).join('\n\n'),
        executionError: `Phase3 review corrections: ${reviewIssues || 'Review requested query-plan correction'}`,
      });
      if (!userRequestedLimit(message)) phase2.limit = null;
      normalized = planner.normalizePlan({ schema: plannerSchema, plan: phase2 });
      phase2 = normalized.plan;
      safety = planner.validateSafety({ schema: plannerSchema, plan: phase2 });
      sql = planner.generateSQL({ schema: plannerSchema, plan: phase2, safety });
      phase3 = await planner.phase3({
        query: message,
        schema: plannerSchema,
        sql,
        extraGuidance: [plannerGuidance, phase3CommonChecks].join('\n\n'),
      });
    }

    const normalizedSql = normalizeSqlForDialect(source.type, sql);
    let finalSql = '';
    try {
      finalSql = sanitizeSql(normalizedSql);
    } catch (error: any) {
      throw new ProjectAgentChatExecutionError(error?.message || 'Generated SQL was invalid', {
        sql: normalizedSql,
        source: { id: source.id, name: source.name, type: source.type },
        reasoning: `SQL sanitization failed for table ${tablePick.tableName}`,
        confidence: phase3.confidence ?? tablePick.confidence ?? null,
      });
    }

    // Compile preflight before execution to catch syntax/dialect issues early.
    try {
      await runWithAdapter(source, buildPreflightSql(finalSql));
    } catch (err: any) {
      throw new ProjectAgentChatExecutionError(err?.message || 'SQL preflight failed', {
        sql: finalSql,
        source: { id: source.id, name: source.name, type: source.type },
        reasoning: `Preflight compile failed for table ${tablePick.tableName}`,
        confidence: phase3.confidence ?? tablePick.confidence ?? null,
      });
    }

    let result: { rows: any[]; rowCount: number };
    try {
      result = await runWithAdapterRetry(source, finalSql, 2);
    } catch (err: any) {
      throw new ProjectAgentChatExecutionError(err?.message || 'Query execution failed', {
        sql: finalSql,
        source: { id: source.id, name: source.name, type: source.type },
        reasoning: `Execution failed after SQL generation for table ${tablePick.tableName}`,
        confidence: phase3.confidence ?? tablePick.confidence ?? null,
      });
    }
    const confidence = phase3.confidence ?? tablePick.confidence ?? null;
    const reasoning = [
      `Table selection: ${tablePick.tableName}`,
      `Table selection rationale: ${tablePick.reasoning}`,
      `Phase1 intent: ${phase1.intent.objective} (${phase1.intent.queryType})`,
      `Phase2 rationale: ${phase2.rationale || 'n/a'}`,
      normalized.notes.length ? `Phase2b normalization: ${normalized.notes.join(' | ')}` : '',
      safety.warnings.length ? `Safety warnings: ${safety.warnings.join(' | ')}` : '',
      phase3.issues.length ? `Phase3 issues: ${phase3.issues.join(' | ')}` : '',
      phase3.fixes.length ? `Phase3 fixes: ${phase3.fixes.join(' | ')}` : '',
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
    const repairHint = buildRepairHint(firstErr?.message || 'unknown', String(firstErr?.sql || '').trim() || undefined);
    try {
      planned = await planAndExecute(repairHint);
      queryResult = planned.result;
      sqlForTrust = planned.sql;
      reasoningForTrust = planned.reasoning;
      confidenceForTrust = planned.confidence;
    } catch (secondErr: any) {
      const sqlFromError = String(secondErr?.sql || firstErr?.sql || '').trim();
      const sourceFromError = secondErr?.source || firstErr?.source || {
        id: source.id,
        name: source.name,
        type: source.type,
      };
      throw new ProjectAgentChatExecutionError(secondErr?.message || firstErr?.message || 'Query execution failed', {
        sql: sqlFromError || undefined,
        source: sourceFromError,
        reasoning: secondErr?.reasoning || firstErr?.reasoning || 'Execution failed after retries',
        confidence:
          Number.isFinite(Number(secondErr?.confidence))
            ? Number(secondErr?.confidence)
            : Number.isFinite(Number(firstErr?.confidence))
              ? Number(firstErr?.confidence)
              : null,
      });
    }
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
      canCreateKpi: true,
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
        sampleRows,
        columns: sampleRows.length
          ? Object.keys(sampleRows[0] || {}).map((name) => ({ name }))
          : [],
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
