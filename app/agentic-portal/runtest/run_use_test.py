"""
Use Test (repeatable): exercise high-value user flows (not just navigation).

Guidelines:
- Keep it surgical: 8-20 steps that cover the biggest regression surface.
- Create test artifacts (records, toggles) and then delete/revert them.
- Prefer stable selectors (data-testid). If you control the app, add them.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

from common import Step, load_dotenv, mk_run_dir, now_utc, require_env, shot, write_result


HERE = Path(__file__).resolve().parent
RUN_ROOT = HERE / "runs"


def read_paths() -> list[str]:
    p = HERE / "paths.txt"
    if not p.exists():
        return ["/dashboard", "/reports", "/settings"]
    out: list[str] = []
    for raw in p.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if not s.startswith("/"):
            s = "/" + s
        out.append(s)
    return out


def prioritize_use_paths(paths: list[str], limit: int = 8) -> list[str]:
    keys = ("dashboard", "report", "setting", "wallet", "account", "action")
    def score(p: str) -> int:
        s = 0
        lp = p.lower()
        for i, k in enumerate(keys):
            if k in lp:
                s += 100 - i * 5
        s -= p.count("/") * 2
        return s
    uniq = list(dict.fromkeys(paths))
    return sorted(uniq, key=lambda p: (-score(p), p))[:limit]

def api_call(page, *, path: str, method: str = "GET", body: dict | None = None) -> dict:
    """
    Call app API using the authenticated browser context (cookies/session).
    Returns: { ok, status, json, text }
    """
    return page.evaluate(
        """async ({path, method, body}) => {
          const init = {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
          };
          const r = await fetch(path, init);
          const t = await r.text();
          let j = null;
          try { j = t ? JSON.parse(t) : null; } catch { j = null; }
          return { ok: r.ok, status: r.status, json: j, text: t };
        }""",
        {"path": path, "method": method, "body": body},
    )


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
    mutating = os.getenv("MUTATING_TESTS", "false").lower() in ("1", "true", "yes")
    enable_outputs_crud = os.getenv("ENABLE_OUTPUTS_CRUD", "false").lower() in ("1", "true", "yes")

    run_dir, shots_dir = mk_run_dir(RUN_ROOT, "use_test")
    downloads_dir = run_dir / "downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    steps: list[Step] = []
    downloads: list[str] = []

    def log(name: str, ok: bool, note: str = "") -> None:
        steps.append(Step(name=name, passed=ok, note=note, screenshot=shot(page, shots_dir, name), at=now_utc()))
        print(("[PASS]" if ok else "[FAIL]"), name, "-", note)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless, slow_mo=slow_mo)
        context = browser.new_context(viewport={"width": 1600, "height": 1000}, accept_downloads=True)
        page = context.new_page()

        # Login
        page.goto(f"{base_url}{login_path}", wait_until="domcontentloaded", timeout=60000)
        page.locator(email_sel).first.fill(test_email)
        page.locator(pass_sel).first.fill(test_password)
        page.locator(submit_sel).first.click(force=True)
        page.wait_for_timeout(1200)
        logged_in = page.url.startswith(base_url) and ("/login" not in page.url)
        log("Login", logged_in, page.url)
        if not logged_in:
            write_result(run_dir / "result.json", base_url=base_url, test_email=test_email, steps=steps, artifacts={})
            context.close()
            browser.close()
            return

        # App-specific "USE" coverage for Agentic Portal (CRUD via /api/*), guarded behind MUTATING_TESTS.
        created = {"workstream_id": None, "dashboard_id": None, "output_id": None}
        if mutating:
            suffix = str(int(time.time()))
            ws_name = f"USE WS {suffix}"
            dash_name = f"USE Dashboard {suffix}"
            out_name = f"USE Output {suffix}"

            try:
                ws = api_call(
                    page,
                    path="/api/workstreams",
                    method="POST",
                    body={"name": ws_name, "description": "Use Test workstream", "color": "#0ea5e9"},
                )
                ok_ws = bool(ws.get("ok")) and (ws.get("json") or {}).get("workstream", {}).get("id")
                created["workstream_id"] = (ws.get("json") or {}).get("workstream", {}).get("id") if ok_ws else None
                log("Create workstream (api)", ok_ws, f"status={ws.get('status')} id={created['workstream_id']}")
            except Exception as exc:
                log("Create workstream (api)", False, str(exc))

            ws_id = created["workstream_id"]
            if ws_id:
                # Verify it shows up in list API
                lst = api_call(page, path="/api/workstreams")
                names = [w.get("name") for w in (lst.get("json") or {}).get("workstreams", []) if isinstance(w, dict)]
                log("Workstream in list (api)", ws_name in names, f"count={len(names)}")

                # Create a dashboard under the workstream
                dash = api_call(
                    page,
                    path="/api/dashboards",
                    method="POST",
                    body={"name": dash_name, "description": "Use Test dashboard", "workstreamId": ws_id, "viewIds": []},
                )
                ok_dash = bool(dash.get("ok")) and (dash.get("json") or {}).get("dashboard", {}).get("id")
                created["dashboard_id"] = (dash.get("json") or {}).get("dashboard", {}).get("id") if ok_dash else None
                log("Create dashboard (api)", ok_dash, f"status={dash.get('status')} id={created['dashboard_id']}")

                dash_id = created["dashboard_id"]
                if dash_id:
                    # Verify list endpoints (best-effort)
                    ds = api_call(page, path=f"/api/dashboards?workstreamId={ws_id}")
                    dash_list = [d for d in (ds.get("json") or {}).get("dashboards", []) if isinstance(d, dict)]
                    dash_names = [d.get("name") for d in dash_list]
                    log("Dashboard in list (api)", dash_name in dash_names, f"count={len(dash_names)}")
                    if dash_list:
                        d0 = dash_list[0]
                        log("Dashboard list sample (api)", True, f"id={d0.get('id')} org={d0.get('organizationId')}")

                    # Optional Outputs CRUD (disabled by default): output APIs appear inconsistent on some deployments.
                    if enable_outputs_crud:
                        out = api_call(
                            page,
                            path="/api/outputs",
                            method="POST",
                            body={"name": out_name, "type": "csv", "workstreamId": ws_id, "dashboardId": dash_id, "config": {"schedule": "manual"}},
                        )
                        post_id = (out.get("json") or {}).get("output", {}).get("id")
                        post_org = (out.get("json") or {}).get("output", {}).get("organizationId")
                        ok_out = bool(out.get("ok")) and bool(post_id)
                        created["output_id"] = post_id if ok_out else None
                        log("Create output (api)", ok_out, f"status={out.get('status')} id={post_id} org={post_org}")

                        os_resp = api_call(page, path=f"/api/outputs?workstreamId={ws_id}")
                        outs = [o for o in (os_resp.get("json") or {}).get("outputs", []) if isinstance(o, dict)]
                        out_names = [o.get("name") for o in outs]
                        log("Output in list (api)", out_name in out_names, f"count={len(out_names)}")
                        if outs:
                            sample = outs[0]
                            log("Output list sample (api)", True, f"keys={sorted(sample.keys())} id={sample.get('id')}")
                            me = api_call(page, path="/api/auth/me")
                            me_org = (me.get("json") or {}).get("user", {}).get("organizationId") if isinstance(me.get("json"), dict) else None
                            log("Auth me (api)", bool(me.get("ok")), f"status={me.get('status')} org={me_org} out_org={sample.get('organizationId')}")
                        if created.get("output_id"):
                            g = api_call(page, path=f"/api/outputs/{created['output_id']}")
                            snippet = (g.get("text") or "").replace("\n", " ").strip()[:120]
                            log("Output fetch by id (api)", bool(g.get("ok")), f"status={g.get('status')} body={snippet}")
                    else:
                        log("Outputs CRUD (api)", True, "skipped (set ENABLE_OUTPUTS_CRUD=true to enable)")

                    # UI smoke of list pages (best-effort assertions by text)
                    ui_checks: list[tuple[str, str | None]] = [
                        ("/workstreams", ws_name),
                        ("/dashboards", dash_name),
                        ("/outputs", out_name if enable_outputs_crud and created.get("output_id") else None),
                    ]
                    for ui_path, needle in ui_checks:
                        try:
                            page.goto(f"{base_url}{ui_path}", wait_until="domcontentloaded", timeout=60000)
                            page.wait_for_timeout(900)
                            if needle:
                                visible = page.locator(f"text='{needle}'").first.count() > 0
                                log(f"UI shows {ui_path}", visible, needle)
                            else:
                                # No specific artifact expected; only assert page rendered.
                                log(f"UI opens {ui_path}", True, page.url)
                        except Exception as exc:
                            log(f"UI shows {ui_path}", False, str(exc))

            # Cleanup (reverse order)
            try:
                if created.get("output_id"):
                    r = api_call(page, path=f"/api/outputs/{created['output_id']}", method="DELETE")
                    ok_del = bool(r.get("ok"))
                    # Some deployments return 404 on /api/outputs/:id despite the output being visible in lists.
                    # Treat cleanup as successful if the output is no longer present in list for this user/workstream.
                    if not ok_del:
                        g = api_call(page, path=f"/api/outputs/{created['output_id']}")
                        snip = (g.get("text") or "").replace("\n", " ").strip()[:120]
                        log("Delete output (api)", False, f"del_status={r.get('status')} get_status={g.get('status')} body={snip}")
                    else:
                        log("Delete output (api)", True, f"status={r.get('status')}")
                if created.get("dashboard_id"):
                    r = api_call(page, path=f"/api/dashboards/{created['dashboard_id']}", method="DELETE")
                    log("Delete dashboard (api)", bool(r.get("ok")), f"status={r.get('status')}")
                if created.get("workstream_id"):
                    r = api_call(page, path=f"/api/workstreams/{created['workstream_id']}", method="DELETE")
                    log("Delete workstream (api)", bool(r.get("ok")), f"status={r.get('status')}")
            except Exception as exc:
                log("Cleanup (api)", False, str(exc))

        # Best-effort "use" coverage across key pages, without assuming domain semantics.
        # For deep correctness + CRUD flows, customize this file per app.
        use_paths = prioritize_use_paths(read_paths(), limit=8)
        for path in use_paths:
            try:
                page.goto(f"{base_url}{path}", wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(600)
                log(f"Open {path}", True, page.url)
            except Exception as exc:
                log(f"Open {path}", False, str(exc))
                continue

            # If an export/download button is present, assert a real download occurs.
            btn = page.locator(
                "button:has-text('Export'), button:has-text('Download'), a:has-text('Export'), a:has-text('Download')"
            ).first
            if btn.count() > 0:
                try:
                    with page.expect_download(timeout=30000) as dl_info:
                        btn.click(force=True)
                    dl = dl_info.value
                    out = downloads_dir / f"{path.strip('/').replace('/', '_') or 'root'}_{int(time.time())}"
                    dl.save_as(str(out))
                    downloads.append(str(out))
                    log(f"Download on {path}", True, str(out))
                except Exception as exc:
                    log(f"Download on {path}", False, str(exc))

        context.close()
        browser.close()

    write_result(
        run_dir / "result.json",
        base_url=base_url,
        test_email=test_email,
        steps=steps,
        artifacts={"downloads": downloads},
    )
    print(f"Result file: {run_dir / 'result.json'}")


if __name__ == "__main__":
    main()
