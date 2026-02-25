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
