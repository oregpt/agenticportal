"""
Run all tests in this directory in a predictable order.

By default this runs the fast suites:
- Smoke Test
- Use Test

Volume Test is intentionally excluded by default because it can run for a long time.
Use --include-volume to run it too.

Usage (PowerShell):
  cd app/agentic-portal/runtest
  python run_all.py
  python run_all.py --include-volume --volume-iterations 10 --volume-delay-seconds 60
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from common import load_dotenv


HERE = Path(__file__).resolve().parent


def run(script: Path, *, env: dict[str, str]) -> int:
    print(f"\n==> {script.name}")
    proc = subprocess.run([sys.executable, "-u", str(script)], cwd=str(HERE), env=env)
    return int(proc.returncode)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--include-volume", action="store_true", help="Also run the long-running volume test.")
    ap.add_argument("--volume-iterations", type=int, default=60)
    ap.add_argument("--volume-delay-seconds", type=int, default=60)
    args = ap.parse_args()

    # Load local config if present (gitignored).
    load_dotenv(HERE / ".env")

    # Make runs deterministic/fast unless user overrides.
    env = os.environ.copy()
    env.setdefault("HEADLESS", "true")
    env.setdefault("SLOW_MO_MS", "0")

    rc = 0
    rc |= run(HERE / "run_smoke_test.py", env=env)
    rc |= run(HERE / "run_use_test.py", env=env)

    if args.include_volume:
        volume = HERE / "run_volume_test.py"
        cmd = [sys.executable, "-u", str(volume), "--iterations", str(args.volume_iterations), "--delay-seconds", str(args.volume_delay_seconds)]
        print(f"\n==> {volume.name} (iterations={args.volume_iterations} delay_seconds={args.volume_delay_seconds})")
        proc = subprocess.run(cmd, cwd=str(HERE), env=env)
        rc |= int(proc.returncode)

    return rc


if __name__ == "__main__":
    raise SystemExit(main())

