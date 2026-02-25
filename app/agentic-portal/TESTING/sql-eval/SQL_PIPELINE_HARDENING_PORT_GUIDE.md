# SQL Pipeline Hardening Port Guide

This document captures the exact hardening applied to the 3-phase Project Agent SQL pipeline so it can be ported to another repo using the same flow.

## Commit References

- `8797ba5` `Harden SQL review pipeline and add failed-run replay harness`
- `f05c373` `Use dialect-safe LIMIT-0 wrapper for SQL preflight`

## Files Changed

1. `src/server/project-agent/chatService.ts`
2. `src/server/project-agent/plannerService.ts`
3. `src/server/project-agent/promptService.ts`
4. `TESTING/sql-eval/replay-failed-runs.mjs`

## What Was Implemented

### 1) Review Stage Hardening (Phase 3)

In `src/server/project-agent/plannerService.ts`:

- `Phase3Result` changed from:
  - `issues[] + correctedSQL`
- to:
  - `issues[] + fixes[]` (advisory fix instructions, no SQL rewrite payload)

Prompt updated so Phase 3 must:

- review SQL
- return strict JSON
- **not** generate replacement SQL
- provide concrete fix instructions in `fixes[]`

### 2) Keep SQL Generation Deterministic

In `src/server/project-agent/chatService.ts`:

- removed direct use of `phase3.correctedSQL`
- if Phase 3 is not approved (or has issues), we re-run **Phase 2 plan** with review feedback and regenerate SQL from planner logic

This keeps SQL generation inside deterministic planner methods rather than freeform model rewrite.

### 3) Common Error Guardrails Added

In `src/server/project-agent/chatService.ts`:

- added `phase3CommonChecks` and inject into Phase 3 guidance:
  - malformed keyword detection (`GROBY`/`GROB` class)
  - `DATE_DIFF` vs `DATEDIFF` for BigQuery
  - no quoted SQL functions (`'DATE_SUB(...)'`)
  - group-by consistency
  - scalar-only division
  - read-only SELECT/WITH enforcement

In `src/server/project-agent/promptService.ts` default Phase 3 prompt:

- added concise common-failure checklist line matching the above themes.

### 4) SQL Normalization Before Sanitization

In `src/server/project-agent/chatService.ts`:

- added `normalizeSqlForDialect(sourceType, sql)`:
  - fixes malformed `GROUP BY` variants (`GROBY`, `GROB`)
  - unquotes SQL function literals like `'DATE_SUB(...)'`
  - maps `DATEDIFF(` -> `DATE_DIFF(` for BigQuery-family sources

### 5) Preflight Compile Gate (Before Execution)

In `src/server/project-agent/chatService.ts`:

- added preflight query build:
  - `SELECT * FROM (<sql>) AS __preflight LIMIT 0`
- executes preflight first
- only runs full query when preflight succeeds

Note:

- preflight originally used `EXPLAIN`, but BigQuery in this environment rejected it (`ExplainStatement` not supported), so it was replaced with the wrapper query above in commit `f05c373`.

### 6) Transient Error Retry Wrapper

In `src/server/project-agent/chatService.ts`:

- added transient detection (`502/503/504`, `fetch failed`, network/socket/timeout)
- added `runWithAdapterRetry(...)` with bounded retry and short backoff

### 7) Targeted Repair Hint Builder

In `src/server/project-agent/chatService.ts`:

- added `buildRepairHint(errorMessage, sqlText?)` to generate focused repair context from known failure classes:
  - read-only violations
  - date function/dialect errors
  - group-by aggregation errors
  - non-scalar division
  - malformed keywords
  - transient infrastructure failures

Used by the existing second-pass retry path.

### 8) Failure Replay Harness (Only Failed Cases)

Added `TESTING/sql-eval/replay-failed-runs.mjs`:

- inputs previous eval output file (default: `TESTING/sql-eval/e2e-sql-eval-100.json`)
- extracts failed runs only
- replays same `(projectId, sourceId, prompt)` tuples
- writes replay output JSON

This avoids rerunning all 100 when only failed cases matter.

## Repro Commands

From repo root:

```powershell
& .\TESTING\.local\sql-eval-profile.ps1
node TESTING/sql-eval/replay-failed-runs.mjs --input TESTING/sql-eval/e2e-sql-eval-100.json --out TESTING/sql-eval/e2e-sql-eval-failed-replay-postpatch2.json
```

Build validation:

```powershell
npm run build
```

## Measured Result (Focused 25 Replay)

From `TESTING/sql-eval/e2e-sql-eval-failed-replay-postpatch2.json`:

- `replayedCount`: 25
- `successCount`: 24
- `failureCount`: 1
- remaining failure:
  - `Sales Transactions`, prompt index `37`, error `fetch failed` (transient infra/network class)

## Porting Notes for the Other Project

1. Port `Phase3Result` schema change and prompt constraints first.
2. Port deterministic regeneration rule in chat orchestration:
   - review feedback -> rerun phase2 -> regenerate SQL
3. Port normalization + preflight + retry wrappers together (they are designed as one reliability layer).
4. Port the failed-run replay harness so validation can stay focused on residual failures.

---

## AgentHub-Specific Port Instructions (Copy/Paste Ready)

Target project naming context:

- Platform: `AgentHub`
- Feature area: `data module`
- Agent surface: the "agents" flow used during query writing

If file names differ, map by function (phase planner, chat orchestrator, prompt templates).

### A) Planner Phase 3 Contract Change

In your planner types file (AgentHub equivalent of `plannerService.ts`), replace:

```ts
export interface Phase3Result {
  approved: boolean;
  confidence: number;
  issues: string[];
  correctedSQL?: string;
  explanation: string;
}
```

with:

```ts
export interface Phase3Result {
  approved: boolean;
  confidence: number;
  issues: string[];
  fixes: string[];
  explanation: string;
}
```

In the Phase 3 prompt builder, replace corrected-SQL output instruction with:

```ts
'{"approved":true,"confidence":0.0,"issues":["..."],"fixes":["..."],"explanation":"..."}',
'Do not generate replacement SQL. Provide concrete fix instructions in fixes[].',
```

And parse:

```ts
fixes: toArray<string>(parsed.fixes).map((s) => String(s)).filter(Boolean),
```

### B) Add SQL Reliability Utilities to Chat Orchestration

Add these helpers in the chat orchestrator (AgentHub equivalent of `chatService.ts`):

```ts
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

function normalizeSqlForDialect(sourceType: string, sql: string): string {
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

async function runWithAdapterRetry(
  source: any,
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
      if (attempt >= maxAttempts || !isTransientExecutionError(message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Query execution failed');
}
```

### C) Make Phase 3 Advisory, Not a Direct SQL Rewriter

In your `planAndExecute(...)` flow:

1. Generate SQL from planner as usual.
2. Run Phase 3 review.
3. If Phase 3 is not approved or has issues:
   - rerun **Phase 2** with review feedback
   - regenerate SQL from planner
4. Normalize SQL (`normalizeSqlForDialect`)
5. Sanitize SQL (read-only rules)
6. Run preflight compile (`buildPreflightSql`)
7. Execute using `runWithAdapterRetry`

The key rule:

- do **not** assign `sql = phase3.correctedSQL`.

### D) Inject Common Error Checks into Review Guidance

In the chat orchestration, append this to Phase 3 extra guidance:

```ts
const phase3CommonChecks = [
  'Phase3 mandatory checks:',
  '- Validate SQL keywords and syntax; reject malformed tokens like GROBY/GROB.',
  '- For BigQuery dialect use DATE_DIFF(...), never DATEDIFF(...).',
  '- Never quote SQL function expressions (e.g. DATE_SUB(...) must not be in quotes).',
  '- All non-aggregated SELECT columns must appear in GROUP BY when aggregating.',
  '- Division operands must be scalar numeric expressions only.',
  '- Output only SELECT/WITH read-only SQL.',
].join('\n');
```

Also update default prompt template text (AgentHub equivalent of prompt service) to include:

```ts
'Common failure checks: GROUP BY spelling/placement, BigQuery DATE_DIFF (not DATEDIFF), no quoted SQL functions (e.g. DATE_SUB), and no non-scalar division operands.',
```

### E) Targeted Repair Hint Builder

Add:

```ts
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
  if (lower.includes('datediff')) hints.push('For BigQuery use DATE_DIFF(end_date, start_date, DAY), never DATEDIFF().');
  if (lower.includes('could not cast literal \"date_sub')) hints.push('Never quote SQL functions. Use DATE_SUB(...) as expression, not as string literal.');
  if (lower.includes('neither grouped nor aggregated')) hints.push('Every non-aggregated selected column must be included in GROUP BY.');
  if (lower.includes('no matching signature for operator /')) hints.push('Do not divide by structs/records. Divide only scalar numeric expressions.');
  if (lower.includes('syntax error') || lower.includes('groby') || lower.includes('grob')) hints.push('Fix SQL keyword spelling and structure, especially GROUP BY/ORDER BY clauses.');
  if (isTransientExecutionError(lower)) hints.push('Transient execution failure detected; keep logic stable and avoid unnecessary complexity.');
  if (sqlText) hints.push(`Last attempted SQL:\n${sqlText}`);
  return hints.join('\n');
}
```

Use this in your existing second-pass retry path.

### F) Add Failed-Only Replay Harness to AgentHub

Port `TESTING/sql-eval/replay-failed-runs.mjs` directly and adjust API paths if needed.

Expected behavior:

1. Read prior eval JSON.
2. Extract `ok=false` rows.
3. Re-run only those prompts against same `projectId/sourceId`.
4. Emit a replay JSON with per-case old/new error context.

---

## Message to AgentHub Coding Agent (Ready to Paste)

Use this verbatim with your AgentHub coding agent:

```text
Implement the SQL reliability hardening from Agentic Portal into AgentHub data-module agent flow.

Required changes:
1) Make Phase 3 advisory only: remove correctedSQL rewrite path and switch to issues[] + fixes[] contract.
2) In chat orchestration, if Phase 3 fails, rerun phase2 with review feedback and regenerate SQL deterministically.
3) Add SQL normalization and dialect guards:
   - GROBY/GROB -> GROUP BY
   - unquote DATE_SUB(...) literals
   - DATEDIFF -> DATE_DIFF for BigQuery
4) Add preflight compile gate before execution:
   SELECT * FROM (<sql>) AS __preflight LIMIT 0
5) Add transient execution retry wrapper for 502/503/504/fetch/network timeout errors.
6) Add targeted repair hint builder from runtime errors.
7) Update Phase 3 prompt with concise common-failure checklist.
8) Add failed-only replay harness for eval reruns.

Reference implementation document:
TESTING/sql-eval/SQL_PIPELINE_HARDENING_PORT_GUIDE.md

Deliverables:
- code changes
- build passing
- replay of prior failed cases and summary deltas
```
