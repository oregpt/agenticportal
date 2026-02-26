# Platform Test Harness

This repo now has three reusable harness layers:

1. `API Smoke` (fast backend regression)
2. `Webapp E2E` (Smoke/Use/Volume via Playwright Python harness)
3. `SQL Eval` (configured only; do not auto-run)

## 1) API Smoke

Script: `TESTING/api/run_mcp_static_delivery_smoke.mjs`

Validates:
- Login
- Project/source discovery (Lighthouse MCP)
- Project agent chat
- Save table artifact
- Artifact run snapshot
- Delivery create + run
- Cleanup of created entities

Run:

```powershell
$env:BASE_URL='https://agenticportal.agenticledger.ai'
$env:TEST_EMAIL='clarkai@agenticledger.ai'
$env:TEST_PASSWORD='anything'
node TESTING/api/run_mcp_static_delivery_smoke.mjs
```

Optional:
- `PROJECT_ID`
- `SOURCE_ID`
- `DELIVERY_RECIPIENT`

## One-Command Regression

Runs:
- API smoke
- UI smoke
- UI use

and writes a consolidated report:
- `TESTING/reports/latest.json`
- `TESTING/reports/regression-<timestamp>.json`

```powershell
npm run test:regression
```

## 2) Webapp E2E Harness

Generated folder: `TESTING/webapp-harness`

Important files:
- `run_smoke_test.py`
- `run_use_test.py`
- `run_volume_test.py`
- `workflow_plan.json`
- `.env.example`

Setup:

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r TESTING\webapp-harness\requirements.txt
.\.venv\Scripts\playwright install chromium
```

Run smoke:

```powershell
.\.venv\Scripts\python TESTING\webapp-harness\run_smoke_test.py
```

Run use:

```powershell
.\.venv\Scripts\python TESTING\webapp-harness\run_use_test.py
```

Run volume:

```powershell
.\.venv\Scripts\python TESTING\webapp-harness\run_volume_test.py --iterations 50 --delay-seconds 30
```

Notes:
- Credentials/base URL are local in `TESTING/webapp-harness/.env` (gitignored).
- Keep `MUTATING_TESTS=false` unless running in a dedicated test org.

## 3) SQL Eval Harness (Configured, Not Run)

Location: `TESTING/sql-eval`

Use existing docs:
- `TESTING/sql-eval/README.md`
- `TESTING/.local/sql-eval-profile.ps1`

This harness is intentionally left configured-only per current request.

