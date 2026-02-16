"""
Smoke Test (repeatable): log in, then visit a list of routes and assert the app renders.

Customize:
- runtest/.env (ignored) for BASE_URL/TEST_EMAIL/TEST_PASSWORD and login selectors
- runtest/paths.txt for the routes to cover
"""

from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import sync_playwright

from common import Step, load_dotenv, mk_run_dir, now_utc, require_env, shot, write_result


HERE = Path(__file__).resolve().parent
RUN_ROOT = HERE / "runs"


def read_paths() -> list[str]:
    p = HERE / "paths.txt"
    out: list[str] = []
    for raw in p.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if not s.startswith("/"):
            s = "/" + s
        out.append(s)
    return out


def main() -> None:
    load_dotenv(HERE / ".env")

    base_url = require_env("BASE_URL").rstrip("/")
    test_email = require_env("TEST_EMAIL")
    test_password = require_env("TEST_PASSWORD")

    login_path = os.getenv("LOGIN_PATH", "/login")
    email_sel = os.getenv("EMAIL_SELECTOR", "input[type='email']")
    pass_sel = os.getenv("PASSWORD_SELECTOR", "input[type='password']")
    submit_sel = os.getenv("SUBMIT_SELECTOR", "button[type='submit']")

    slow_mo = int(os.getenv("SLOW_MO_MS", "60"))
    headless = os.getenv("HEADLESS", "false").lower() in ("1", "true", "yes")

    run_dir, shots_dir = mk_run_dir(RUN_ROOT, "smoke_test")
    steps: list[Step] = []

    def log(name: str, ok: bool, note: str = "") -> None:
        steps.append(Step(name=name, passed=ok, note=note, screenshot=shot(page, shots_dir, name), at=now_utc()))
        print(("[PASS]" if ok else "[FAIL]"), name, "-", note)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless, slow_mo=slow_mo)
        context = browser.new_context(viewport={"width": 1600, "height": 1000})
        page = context.new_page()

        # Login
        page.goto(f"{base_url}{login_path}", wait_until="domcontentloaded", timeout=60000)
        page.locator(email_sel).first.fill(test_email)
        page.locator(pass_sel).first.fill(test_password)
        page.locator(submit_sel).first.click(force=True)

        # Give SPA routers time to settle.
        page.wait_for_timeout(1200)
        logged_in = page.url.startswith(base_url) and ("/login" not in page.url)
        log("Login", logged_in, page.url)
        if not logged_in:
            write_result(run_dir / "result.json", base_url=base_url, test_email=test_email, steps=steps, artifacts={})
            context.close()
            browser.close()
            return

        # Visit routes
        for path in read_paths():
            try:
                resp = page.goto(f"{base_url}{path}", wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(600)

                status = resp.status if resp else None
                # Avoid false positives from static strings in HTML; only fail on visible "not found" patterns.
                not_found = page.locator("text=/this page could not be found\\.|\\b404\\b|\\bnot found\\b/i").first
                forbidden = page.locator("text=/forbidden|access denied|not authorized|unauthorized/i").first

                is_nf = False
                is_forbidden = False
                try:
                    is_nf = not_found.count() > 0 and not_found.is_visible()
                except Exception:
                    is_nf = False
                try:
                    is_forbidden = forbidden.count() > 0 and forbidden.is_visible()
                except Exception:
                    is_forbidden = False

                # Pass if HTTP status is OK-ish, or page is restricted (smoke should still treat as reachable).
                ok_status = status is None or (200 <= status < 400) or status == 403
                ok = ok_status and (not is_nf)
                if is_forbidden:
                    ok = True

                note = page.url
                if status is not None:
                    note += f" status={status}"
                if is_forbidden:
                    note += " (restricted)"
                log(f"Visit {path}", ok, note)
            except Exception as exc:
                log(f"Visit {path}", False, str(exc))

        context.close()
        browser.close()

    write_result(run_dir / "result.json", base_url=base_url, test_email=test_email, steps=steps, artifacts={})
    print(f"Result file: {run_dir / 'result.json'}")


if __name__ == "__main__":
    main()
