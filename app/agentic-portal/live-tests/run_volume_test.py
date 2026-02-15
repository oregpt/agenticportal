"""
Volume Test runner: repeatedly execute Smoke Test + Use Test on a cadence.

Design goals:
- Works with the bundled run_smoke_test.py + run_use_test.py (no app-specific logic here)
- Writes a JSONL index so failures are traceable
- Stops on first failure by default

Usage (PowerShell):
  # Create live-tests/.env first (ignored by git)
  python live-tests\\run_volume_test.py --iterations 500 --delay-seconds 60
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from common import load_dotenv, require_env


HERE = Path(__file__).resolve().parent
RUNS_ROOT = HERE / "runs"


def now_utc() -> str:
    return datetime.utcnow().isoformat() + "Z"


@dataclass
class TestRun:
    name: str
    ok: bool
    result_json: str
    run_id: str
    duration_sec: float


def newest_result(prefix: str) -> Path | None:
    if not RUNS_ROOT.exists():
        return None
    candidates = sorted(
        [p for p in RUNS_ROOT.glob(f"{prefix}_*/result.json") if p.is_file()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def parse_ok(result_path: Path) -> tuple[bool, str]:
    try:
        j = json.loads(result_path.read_text(encoding="utf-8"))
        summ = j.get("summary") or {}
        failed = int(summ.get("failed", 0))
        passed = int(summ.get("passed", 0))
        total = int(summ.get("total", passed + failed))
        ok = failed == 0 and total > 0
        return ok, f"{passed}/{total}"
    except Exception as exc:
        return False, f"parse_failed: {exc}"


def run_script(script: Path, *, prefix: str, env: dict[str, str]) -> TestRun:
    start = time.time()
    proc = subprocess.run([sys.executable, str(script)], cwd=str(HERE.parent), env=env, text=True)
    dur = time.time() - start

    result = newest_result(prefix)
    if not result:
        return TestRun(script.name, False, "", "", dur)

    ok, _ = parse_ok(result)
    return TestRun(script.name, ok and proc.returncode == 0, str(result), result.parent.name, dur)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--iterations", type=int, default=60)
    ap.add_argument("--delay-seconds", type=int, default=60)
    ap.add_argument("--headed", action="store_true", help="Run with a visible browser (sets HEADLESS=false)")
    ap.add_argument("--continue-on-fail", action="store_true", help="Keep going after failures (not recommended)")
    args = ap.parse_args()

    load_dotenv(HERE / ".env")
    base_url = require_env("BASE_URL")
    _ = require_env("TEST_EMAIL")
    _ = require_env("TEST_PASSWORD")

    # Force headless by default for long unattended runs.
    if args.headed:
        os.environ["HEADLESS"] = "false"
    else:
        os.environ.setdefault("HEADLESS", "true")

    # Ensure slow-mo doesn't slow down unattended runs unless explicitly set.
    os.environ.setdefault("SLOW_MO_MS", "0")

    volume_id = "volume_" + datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_dir = RUNS_ROOT / volume_id
    out_dir.mkdir(parents=True, exist_ok=True)
    index_path = out_dir / "index.jsonl"

    env = os.environ.copy()

    smoke = HERE / "run_smoke_test.py"
    use = HERE / "run_use_test.py"
    if not smoke.exists() or not use.exists():
        raise SystemExit("Missing run_smoke_test.py or run_use_test.py next to this script.")

    print(f"[volume] base_url={base_url}")
    print(f"[volume] iterations={args.iterations} delay_seconds={args.delay_seconds} headless={env.get('HEADLESS')}")
    print(f"[volume] index={index_path}")

    for n in range(1, args.iterations + 1):
        cycle_start = now_utc()
        print(f"\\n[cycle {n}/{args.iterations}] start={cycle_start}")

        smoke_run = run_script(smoke, prefix="smoke_test", env=env)
        smoke_ok, smoke_ratio = (False, "n/a")
        if smoke_run.result_json:
            smoke_ok, smoke_ratio = parse_ok(Path(smoke_run.result_json))
        print(f"[cycle {n}] smoke ok={smoke_run.ok} ratio={smoke_ratio} run={smoke_run.run_id} dur={smoke_run.duration_sec:.1f}s")

        use_run = run_script(use, prefix="use_test", env=env)
        use_ok, use_ratio = (False, "n/a")
        if use_run.result_json:
            use_ok, use_ratio = parse_ok(Path(use_run.result_json))
        print(f"[cycle {n}] use   ok={use_run.ok} ratio={use_ratio} run={use_run.run_id} dur={use_run.duration_sec:.1f}s")

        record = {
            "cycle": n,
            "at_utc": cycle_start,
            "smoke": {
                "ok": smoke_run.ok,
                "ratio": smoke_ratio,
                "result_json": smoke_run.result_json,
                "run_id": smoke_run.run_id,
                "duration_sec": round(smoke_run.duration_sec, 2),
            },
            "use": {
                "ok": use_run.ok,
                "ratio": use_ratio,
                "result_json": use_run.result_json,
                "run_id": use_run.run_id,
                "duration_sec": round(use_run.duration_sec, 2),
            },
        }
        with index_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\\n")

        if not (smoke_run.ok and use_run.ok) and not args.continue_on_fail:
            print(f"[cycle {n}] FAIL: stopping. See index: {index_path}")
            return

        if n < args.iterations:
            time.sleep(max(0, args.delay_seconds))

    print(f"\\n[volume] complete. index={index_path}")


if __name__ == "__main__":
    main()

