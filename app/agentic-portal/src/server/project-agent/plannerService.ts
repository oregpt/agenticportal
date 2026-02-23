import type { LLMProvider } from '@/server/llm/types';
import type { ProjectAgentSourceType } from './types';

export type PlannerFieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'unknown';

export interface PlannerField {
  column: string;
  type: PlannerFieldType;
  nullable: boolean;
  description?: string;
}

export interface PlannerSchemaContext {
  sourceType: ProjectAgentSourceType;
  sourceName: string;
  tableName: string;
  fields: PlannerField[];
}

export interface PlannerIntent {
  objective: string;
  entities: string[];
  metrics: string[];
  dimensions: string[];
  queryType: 'retrieval' | 'aggregation' | 'comparison' | 'window' | 'anomaly' | 'mixed';
}

export interface PlannerColumnChoice {
  column: string;
  usage: 'select' | 'filter' | 'group' | 'order' | 'aggregate';
  reason: string;
  confidence: number;
}

export interface Phase1Result {
  intent: PlannerIntent;
  columns: PlannerColumnChoice[];
}

export type FilterOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL'
  | 'BETWEEN';

export interface PlannerFilter {
  column: string;
  operator: FilterOperator;
  value?: string | number | Array<string | number> | [string | number, string | number];
  valueType?: 'string' | 'number' | 'date' | 'datetime' | 'unknown';
}

export type AggregateFunction = 'SUM' | 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'MIN' | 'MAX';

export interface PlannerAggregate {
  function: AggregateFunction;
  column: string;
  alias: string;
}

export interface PlannerOrder {
  column: string;
  direction: 'ASC' | 'DESC';
}

export type WindowFunction = 'RUNNING_SUM' | 'RUNNING_COUNT' | 'RUNNING_AVG';

export interface PlannerWindow {
  function: WindowFunction;
  column: string;
  alias: string;
  partitionBy: string[];
  orderBy?: PlannerOrder;
  frame?: string;
}

export interface Phase2Result {
  select: string[];
  filters: PlannerFilter[];
  aggregations: PlannerAggregate[];
  groupBy: string[];
  orderBy: PlannerOrder[];
  window: PlannerWindow | null;
  limit: number | null;
  rationale: string;
}

export interface SafetyResult {
  issues: string[];
  warnings: string[];
  nullSafeColumns: string[];
  numericCastColumns: string[];
}

export interface Phase3Result {
  approved: boolean;
  confidence: number;
  issues: string[];
  correctedSQL?: string;
  explanation: string;
}

function extractJson(text: string): any {
  const trimmed = String(text || '').trim();
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

function normalizeFieldType(input: string): PlannerFieldType {
  const t = String(input || '').toLowerCase();
  if (['int', 'integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real', 'number', 'float64', 'int64'].includes(t)) return 'number';
  if (['bool', 'boolean'].includes(t)) return 'boolean';
  if (t.includes('timestamp') || t.includes('datetime')) return 'datetime';
  if (t === 'date') return 'date';
  if (['text', 'string', 'varchar', 'char'].includes(t)) return 'string';
  return 'unknown';
}

function isBigQueryFamily(sourceType: ProjectAgentSourceType): boolean {
  return sourceType === 'bigquery' || sourceType === 'google_sheets_live';
}

function quoteIdentifier(sourceType: ProjectAgentSourceType, identifier: string): string {
  const raw = String(identifier || '').trim();
  if (!raw) throw new Error('Invalid identifier');
  if (isBigQueryFamily(sourceType)) {
    return `\`${raw.replace(/`/g, '')}\``;
  }
  return `"${raw.replace(/"/g, '""')}"`;
}

function escapeString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeDirection(direction: unknown): 'ASC' | 'DESC' {
  return String(direction || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
}

function normalizeOperator(input: unknown): FilterOperator {
  const op = String(input || '=').toUpperCase();
  const allowed: FilterOperator[] = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN'];
  return allowed.includes(op as FilterOperator) ? (op as FilterOperator) : '=';
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export class NL2SQLPlannerService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly model: string,
    private readonly projectId: string
  ) {}

  async phase1(input: { query: string; schema: PlannerSchemaContext; extraGuidance?: string }): Promise<Phase1Result> {
    const schemaText = input.schema.fields
      .map((f) => `- ${f.column} (${f.type}${f.nullable ? ', nullable' : ''})${f.description ? `: ${f.description}` : ''}`)
      .join('\n');

    const prompt = [
      'You are Phase 1 of an NL-to-SQL pipeline.',
      'Return strict JSON only.',
      'Task: infer user intent and select candidate columns for query planning.',
      '',
      `User query: ${input.query}`,
      `Source: ${input.schema.sourceName} (${input.schema.sourceType})`,
      `Table: ${input.schema.tableName}`,
      'Schema:',
      schemaText,
      input.extraGuidance ? `Guidance:\n${input.extraGuidance}` : '',
      '',
      'Return JSON:',
      '{"intent":{"objective":"...","entities":["..."],"metrics":["..."],"dimensions":["..."],"queryType":"retrieval|aggregation|comparison|window|anomaly|mixed"},"columns":[{"column":"...","usage":"select|filter|group|order|aggregate","reason":"...","confidence":0.0}]}',
      'Use 3-12 columns max. Prefer columns from schema only.',
    ].filter(Boolean).join('\n');

    const raw = await this.provider.generate(
      [
        { role: 'system', content: 'You output strict JSON for data planning.' },
        { role: 'user', content: prompt },
      ],
      { model: this.model, agentId: this.projectId, maxTokens: 1400 }
    );

    const parsed = extractJson(raw);
    const schemaCols = new Set(input.schema.fields.map((f) => f.column));
    const columnsRaw = toArray<any>(parsed.columns).filter((c) => schemaCols.has(String(c.column || '')));
    const columns: PlannerColumnChoice[] = columnsRaw.map((c) => ({
      column: String(c.column || ''),
      usage: ['select', 'filter', 'group', 'order', 'aggregate'].includes(String(c.usage || '')) ? c.usage : 'select',
      reason: String(c.reason || 'Candidate column'),
      confidence: Number.isFinite(Number(c.confidence)) ? Number(c.confidence) : 0.5,
    }));
    if (!columns.length) {
      const fallback = input.schema.fields.slice(0, Math.min(6, input.schema.fields.length));
      fallback.forEach((f) => columns.push({ column: f.column, usage: 'select', reason: 'Fallback from schema', confidence: 0.2 }));
    }

    const intentRaw = parsed.intent || {};
    const intent: PlannerIntent = {
      objective: String(intentRaw.objective || input.query),
      entities: toArray<string>(intentRaw.entities).map((s) => String(s)),
      metrics: toArray<string>(intentRaw.metrics).map((s) => String(s)),
      dimensions: toArray<string>(intentRaw.dimensions).map((s) => String(s)),
      queryType: ['retrieval', 'aggregation', 'comparison', 'window', 'anomaly', 'mixed'].includes(String(intentRaw.queryType))
        ? intentRaw.queryType
        : 'mixed',
    };

    return { intent, columns };
  }

  async phase2(input: {
    query: string;
    schema: PlannerSchemaContext;
    phase1: Phase1Result;
    extraGuidance?: string;
    executionError?: string;
  }): Promise<Phase2Result> {
    const schemaText = input.schema.fields.map((f) => `- ${f.column} (${f.type}${f.nullable ? ', nullable' : ''})`).join('\n');
    const phase1Cols = input.phase1.columns.map((c) => `- ${c.column} [${c.usage}] (${Math.round(c.confidence * 100)}%)`).join('\n');

    const prompt = [
      'You are Phase 2 of an NL-to-SQL pipeline.',
      'Return strict JSON only.',
      'Create a structured query plan (do not return SQL).',
      '',
      `User query: ${input.query}`,
      `Intent objective: ${input.phase1.intent.objective}`,
      `Intent type: ${input.phase1.intent.queryType}`,
      `Table: ${input.schema.tableName}`,
      'Schema:',
      schemaText,
      'Candidate columns:',
      phase1Cols,
      input.extraGuidance ? `Guidance:\n${input.extraGuidance}` : '',
      input.executionError ? `Previous SQL execution error:\n${input.executionError}` : '',
      '',
      'Return JSON:',
      '{"select":["col"],"filters":[{"column":"col","operator":"=","value":"x","valueType":"string|number|date|datetime|unknown"}],"aggregations":[{"function":"SUM|AVG|COUNT|COUNT_DISTINCT|MIN|MAX","column":"col","alias":"name"}],"groupBy":["col"],"orderBy":[{"column":"col","direction":"ASC|DESC"}],"window":{"function":"RUNNING_SUM|RUNNING_COUNT|RUNNING_AVG","column":"col","alias":"running_metric","partitionBy":["col"],"orderBy":{"column":"col","direction":"ASC|DESC"},"frame":"ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW"},"limit":200,"rationale":"..."}',
      'Rules:',
      '- If query asks totals/averages/counts, use aggregations.',
      '- If aggregation uses plain columns, include those columns in groupBy.',
      '- If query asks cumulative/running totals, use the window object with function + orderBy.',
      '- Include "limit" only when user explicitly asks for top/list/preview behavior.',
    ].filter(Boolean).join('\n');

    const raw = await this.provider.generate(
      [
        { role: 'system', content: 'You output strict JSON plans for SQL generation.' },
        { role: 'user', content: prompt },
      ],
      { model: this.model, agentId: this.projectId, maxTokens: 1800 }
    );
    const parsed = extractJson(raw);
    const schemaCols = new Set(input.schema.fields.map((f) => f.column));

    const select = toArray<string>(parsed.select).map((s) => String(s)).filter((c) => schemaCols.has(c)).slice(0, 16);
    const aggregations: PlannerAggregate[] = toArray<any>(parsed.aggregations)
      .map((a) => ({
        function: ['SUM', 'AVG', 'COUNT', 'COUNT_DISTINCT', 'MIN', 'MAX'].includes(String(a.function || '').toUpperCase())
          ? (String(a.function).toUpperCase() as AggregateFunction)
          : 'COUNT',
        column: String(a.column || ''),
        alias: String(a.alias || `${String(a.function || 'count').toLowerCase()}_${String(a.column || 'value')}`),
      }))
      .filter((a) => a.column === '*' || schemaCols.has(a.column))
      .slice(0, 8);

    const filters: PlannerFilter[] = toArray<any>(parsed.filters)
      .map((f) => ({
        column: String(f.column || ''),
        operator: normalizeOperator(f.operator),
        value: f.value,
        valueType: ['string', 'number', 'date', 'datetime', 'unknown'].includes(String(f.valueType || '')) ? f.valueType : 'unknown',
      }))
      .filter((f) => schemaCols.has(f.column))
      .slice(0, 12);

    const groupBy = toArray<string>(parsed.groupBy).map((s) => String(s)).filter((c) => schemaCols.has(c)).slice(0, 12);
    const orderBy: PlannerOrder[] = toArray<any>(parsed.orderBy)
      .map((o) => ({
        column: String(o.column || ''),
        direction: normalizeDirection(o.direction),
      }))
      .filter((o) => schemaCols.has(o.column))
      .slice(0, 8);

    const rawWindow = parsed.window && typeof parsed.window === 'object' ? parsed.window : null;
    const window: PlannerWindow | null = rawWindow
      ? {
          function: ['RUNNING_SUM', 'RUNNING_COUNT', 'RUNNING_AVG'].includes(String(rawWindow.function || '').toUpperCase())
            ? (String(rawWindow.function || '').toUpperCase() as WindowFunction)
            : 'RUNNING_COUNT',
          column: String(rawWindow.column || ''),
          alias: String(rawWindow.alias || 'running_metric'),
          partitionBy: toArray<string>(rawWindow.partitionBy).map((s) => String(s)).filter((c) => schemaCols.has(c)).slice(0, 8),
          orderBy:
            rawWindow.orderBy && schemaCols.has(String(rawWindow.orderBy.column || ''))
              ? {
                  column: String(rawWindow.orderBy.column || ''),
                  direction: normalizeDirection(rawWindow.orderBy.direction),
                }
              : undefined,
          frame: String(rawWindow.frame || '').trim() || undefined,
        }
      : null;

    const normalizedWindow = window && (window.column === '*' || schemaCols.has(window.column)) ? window : null;
    const limitRaw = Number(parsed.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.trunc(limitRaw) : null;

    return {
      select,
      filters,
      aggregations,
      groupBy,
      orderBy,
      window: normalizedWindow,
      limit,
      rationale: String(parsed.rationale || ''),
    };
  }

  validateSafety(input: { schema: PlannerSchemaContext; plan: Phase2Result }): SafetyResult {
    const fieldMap = new Map(input.schema.fields.map((f) => [f.column, f]));
    const issues: string[] = [];
    const warnings: string[] = [];
    const nullSafeColumns: string[] = [];
    const numericCastColumns: string[] = [];

    for (const f of input.plan.filters) {
      const col = fieldMap.get(f.column);
      if (!col) continue;
      if (f.valueType === 'string' && col.type === 'number') numericCastColumns.push(f.column);
      if ((f.operator === '>' || f.operator === '<' || f.operator === '>=' || f.operator === '<=') && col.type === 'string') {
        warnings.push(`Filter operator ${f.operator} on string column ${f.column} may be invalid.`);
      }
    }

    if (input.plan.aggregations.length > 0 && input.plan.select.length > 0) {
      const selectNotInGroup = input.plan.select.filter((c) => !input.plan.groupBy.includes(c));
      if (selectNotInGroup.length > 0) {
        issues.push(`SELECT columns must be in GROUP BY when using aggregations: ${selectNotInGroup.join(', ')}`);
      }
    }
    if (input.plan.window && input.plan.aggregations.length > 0) {
      warnings.push('Window and aggregation are both present; planner should prefer one primary pattern.');
    }
    if (input.plan.window) {
      const w = input.plan.window;
      if (!w.orderBy || !w.orderBy.column) issues.push('Window queries require orderBy for deterministic running calculations.');
      const wCol = fieldMap.get(w.column);
      if (!wCol && w.column !== '*') issues.push(`Window column not found: ${w.column}`);
      else if (wCol && ['RUNNING_SUM', 'RUNNING_AVG'].includes(w.function) && wCol.type !== 'number') numericCastColumns.push(w.column);
    }

    for (const agg of input.plan.aggregations) {
      const col = fieldMap.get(agg.column);
      if (!col || agg.column === '*') continue;
      if (['SUM', 'AVG'].includes(agg.function) && col.type !== 'number') numericCastColumns.push(agg.column);
      if (col.nullable) nullSafeColumns.push(agg.column);
    }

    return {
      issues,
      warnings,
      nullSafeColumns: [...new Set(nullSafeColumns)],
      numericCastColumns: [...new Set(numericCastColumns)],
    };
  }

  generateSQL(input: { schema: PlannerSchemaContext; plan: Phase2Result; safety: SafetyResult }): string {
    const sourceType = input.schema.sourceType;
    const tableExpr = isBigQueryFamily(sourceType) ? `\`${input.schema.tableName}\`` : `"${input.schema.tableName}"`;
    const needsAggregation = input.plan.aggregations.length > 0;
    const castNumericType = isBigQueryFamily(sourceType) ? 'FLOAT64' : 'DOUBLE PRECISION';

    const selectParts: string[] = [];
    for (const c of input.plan.select) selectParts.push(quoteIdentifier(sourceType, c));
    for (const agg of input.plan.aggregations) {
      const columnExpr = agg.column === '*' ? '*' : quoteIdentifier(sourceType, agg.column);
      const casted = input.safety.numericCastColumns.includes(agg.column) ? `CAST(${columnExpr} AS ${castNumericType})` : columnExpr;
      const nullSafe = input.safety.nullSafeColumns.includes(agg.column) ? `COALESCE(${casted}, 0)` : casted;
      let expr = '';
      switch (agg.function) {
        case 'COUNT_DISTINCT':
          expr = `COUNT(DISTINCT ${columnExpr})`;
          break;
        case 'COUNT':
          expr = agg.column === '*' ? 'COUNT(*)' : `COUNT(${columnExpr})`;
          break;
        default:
          expr = `${agg.function}(${nullSafe})`;
          break;
      }
      selectParts.push(`${expr} AS ${quoteIdentifier(sourceType, agg.alias)}`);
    }

    if (input.plan.window) {
      const w = input.plan.window;
      const orderExpr = w.orderBy ? `${quoteIdentifier(sourceType, w.orderBy.column)} ${w.orderBy.direction}` : '';
      const partitionExpr = w.partitionBy.length
        ? `PARTITION BY ${w.partitionBy.map((c) => quoteIdentifier(sourceType, c)).join(', ')}`
        : '';
      const frameExpr = (w.frame || 'ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW').toUpperCase();
      const overParts = [partitionExpr, orderExpr, frameExpr].filter(Boolean).join(' ');
      const rawColExpr = w.column === '*' ? '*' : quoteIdentifier(sourceType, w.column);
      const castedExpr = input.safety.numericCastColumns.includes(w.column)
        ? `CAST(${rawColExpr} AS ${castNumericType})`
        : rawColExpr;
      let windowExpr = '';
      if (w.function === 'RUNNING_SUM') windowExpr = `SUM(${castedExpr}) OVER (${overParts})`;
      else if (w.function === 'RUNNING_AVG') windowExpr = `AVG(${castedExpr}) OVER (${overParts})`;
      else windowExpr = `COUNT(*) OVER (${overParts})`;
      selectParts.push(`${windowExpr} AS ${quoteIdentifier(sourceType, w.alias)}`);
    }
    if (!selectParts.length) selectParts.push('*');

    const whereParts: string[] = [];
    for (const cond of input.plan.filters) {
      const col = quoteIdentifier(sourceType, cond.column);
      const op = cond.operator;
      if (op === 'IS NULL' || op === 'IS NOT NULL') {
        whereParts.push(`${col} ${op}`);
        continue;
      }
      if (op === 'IN' || op === 'NOT IN') {
        const vals = Array.isArray(cond.value) ? cond.value : [];
        if (!vals.length) continue;
        const formatted = vals.map((v) => (typeof v === 'number' ? String(v) : `'${escapeString(String(v))}'`)).join(', ');
        whereParts.push(`${col} ${op} (${formatted})`);
        continue;
      }
      if (op === 'BETWEEN') {
        const vals = Array.isArray(cond.value) ? cond.value : [];
        if (vals.length !== 2) continue;
        const [a, b] = vals;
        const left = typeof a === 'number' ? String(a) : `'${escapeString(String(a))}'`;
        const right = typeof b === 'number' ? String(b) : `'${escapeString(String(b))}'`;
        whereParts.push(`${col} BETWEEN ${left} AND ${right}`);
        continue;
      }
      const value = cond.value;
      if (value === undefined || value === null) continue;
      const formatted = typeof value === 'number' ? String(value) : `'${escapeString(String(value))}'`;
      whereParts.push(`${col} ${op} ${formatted}`);
    }

    const groupByCols = needsAggregation ? [...new Set(input.plan.groupBy.map((c) => quoteIdentifier(sourceType, c)))] : [];
    const orderByParts = input.plan.orderBy.map((o) => `${quoteIdentifier(sourceType, o.column)} ${o.direction}`);
    const limit = Number.isFinite(Number(input.plan.limit)) && Number(input.plan.limit) > 0 ? Math.trunc(Number(input.plan.limit)) : null;

    const sqlParts: string[] = [];
    sqlParts.push(`SELECT ${selectParts.join(',\n       ')}`);
    sqlParts.push(`FROM ${tableExpr}`);
    if (whereParts.length) sqlParts.push(`WHERE ${whereParts.join('\n  AND ')}`);
    if (groupByCols.length) sqlParts.push(`GROUP BY ${groupByCols.join(', ')}`);
    if (orderByParts.length) sqlParts.push(`ORDER BY ${orderByParts.join(', ')}`);
    if (limit !== null) sqlParts.push(`LIMIT ${limit}`);
    return sqlParts.join('\n');
  }

  async phase3(input: { query: string; schema: PlannerSchemaContext; sql: string; extraGuidance?: string }): Promise<Phase3Result> {
    const schemaText = input.schema.fields
      .slice(0, 120)
      .map((f) => `- ${f.column} (${f.type}${f.nullable ? ', nullable' : ''})`)
      .join('\n');

    const prompt = [
      'You are Phase 3 SQL reviewer.',
      'Review SQL against user query and schema.',
      'Return strict JSON only.',
      '',
      `User query: ${input.query}`,
      `Table: ${input.schema.tableName}`,
      'Schema:',
      schemaText,
      '',
      'SQL to review:',
      input.sql,
      input.extraGuidance ? `Guidance:\n${input.extraGuidance}` : '',
      '',
      'Return JSON:',
      '{"approved":true,"confidence":0.0,"issues":["..."],"correctedSQL":"","explanation":"..."}',
      'If approved=true, correctedSQL may be empty.',
    ].filter(Boolean).join('\n');

    const raw = await this.provider.generate(
      [
        { role: 'system', content: 'You review SQL and return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      { model: this.model, agentId: this.projectId, maxTokens: 1500 }
    );

    const parsed = extractJson(raw);
    return {
      approved: !!parsed.approved,
      confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.5,
      issues: toArray<string>(parsed.issues).map((s) => String(s)),
      correctedSQL: parsed.correctedSQL ? String(parsed.correctedSQL) : undefined,
      explanation: String(parsed.explanation || ''),
    };
  }
}

export function inferFieldType(input: string): PlannerFieldType {
  return normalizeFieldType(input);
}
