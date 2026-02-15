from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Page


def load_dotenv(dotenv_path: Path) -> None:
    """
    Minimal .env loader (no external deps).
    - KEY=VALUE
    - ignores blank lines and lines starting with '#'
    - does not override already-set environment variables
    """
    if not dotenv_path.exists():
        return
    for raw in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip("\"").strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def now_utc() -> str:
    return datetime.utcnow().isoformat() + "Z"


def mk_run_dir(run_root: Path, run_prefix: str) -> tuple[Path, Path]:
    run_id = f"{run_prefix}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    run_dir = run_root / run_id
    shots_dir = run_dir / "screenshots"
    shots_dir.mkdir(parents=True, exist_ok=True)
    return run_dir, shots_dir


def safe_filename(label: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in label)
    return safe[:120] if safe else "step"


def shot(page: Page, folder: Path, label: str) -> str:
    out = folder / f"{safe_filename(label)}_{int(time.time() * 1000)}.png"
    page.screenshot(path=str(out), full_page=True)
    return str(out)


@dataclass
class Step:
    name: str
    passed: bool
    note: str
    screenshot: str
    at: str


def write_result(
    out_path: Path,
    *,
    base_url: str,
    test_email: str,
    steps: list[Step],
    artifacts: dict,
) -> None:
    summary = {
        "run_at_utc": now_utc(),
        "base_url": base_url,
        "email": test_email,
        "summary": {
            "total": len(steps),
            "passed": sum(1 for s in steps if s.passed),
            "failed": sum(1 for s in steps if not s.passed),
        },
        "artifacts": artifacts,
        "steps": [asdict(s) for s in steps],
    }
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")


def require_env(key: str) -> str:
    v = os.getenv(key, "").strip()
    if not v:
        raise SystemExit(f"Missing required env var: {key}")
    return v
