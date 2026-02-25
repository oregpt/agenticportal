# SQL Eval Harness

Run from repo root:

```powershell
& .\TESTING\.local\sql-eval-profile.ps1
npm run test:agent-sql
```

Output file defaults to `TESTING/sql-eval/e2e-sql-eval-100.json` from the local profile.

You can override values directly:

```powershell
$env:TOTAL_RUNS='25'
$env:OUT_FILE='TESTING/sql-eval/e2e-sql-eval-25.json'
npm run test:agent-sql
```
