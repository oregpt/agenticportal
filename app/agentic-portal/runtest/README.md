# Run Tests (Smoke, Use, Volume)

This folder is a lightweight, repeatable test harness for exercising the deployed app as a user (via HTTP/API calls).

## Setup

1. Create `app/agentic-portal/runtest/.env` (this file is gitignored).
2. Start with the provided template:

```bash
cp .env.example .env
```

## Run

From `app/agentic-portal/runtest`:

```bash
python run_smoke_test.py
python run_use_test.py
python run_volume_test.py
python run_all.py
```

Artifacts are written under `runs/`.

## What Each Suite Does

### Smoke Test
- Verifies the base URL is reachable.
- Probes known UI routes from `paths.txt`.
- Fails on HTTP errors and obvious "not found/forbidden" page bodies.

### Use Test
- Logs in (API) using the credentials in `.env`.
- Exercises core platform flows in a safe way.
- Optional: enable mutating CRUD (create + cleanup) using feature flags in `.env`.

### Volume Test
- Repeats a subset of fast checks over multiple cycles to catch flakiness.

## Flags (in `.env`)

- `MUTATING_TESTS=true|false`
  - When `true`, the Use Test will attempt safe CRUD on supported endpoints and then delete created records.
  - Default should be `false` for production-like environments unless you explicitly want it.

- `ENABLE_OUTPUTS_CRUD=true|false`
  - When `true` and `MUTATING_TESTS=true`, the Use Test will attempt Outputs create/get-by-id/delete.
  - This is the strictest validation for the Outputs feature.
