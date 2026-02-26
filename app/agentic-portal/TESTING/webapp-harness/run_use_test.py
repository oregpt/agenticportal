"""
Use Test (repeatable): CRUD + workflow-ready coverage in authenticated browser context.

Guidelines:
- Keep it surgical: cover high-value workflows, not only navigation.
- Create artifacts, verify outputs, then clean up in reverse dependency order.
- Keep mutating behavior behind MUTATING_TESTS for production safety.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright

from common import Step, load_dotenv, mk_run_dir, now_utc, require_env, shot, write_result


HERE = Path(__file__).resolve().parent
RUN_ROOT = HERE / "runs"


class SafeMap(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


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


def read_workflow_plan() -> dict:
    p = HERE / "workflow_plan.json"
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


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


def render_value(v: Any, state: dict[str, str]) -> Any:
    if isinstance(v, str):
        return v.format_map(SafeMap(**state))
    if isinstance(v, dict):
        return {k: render_value(val, state) for k, val in v.items()}
    if isinstance(v, list):
        return [render_value(x, state) for x in v]
    return v


def render_path(path: str, state: dict[str, str]) -> str:
    out = path.format_map(SafeMap(**state))

    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        if key in state and state[key]:
            return str(state[key])
        alt = key + "Id"
        if alt in state and state[alt]:
            return str(state[alt])
        if key == "id":
            for k in state:
                if k.endswith("Id") and state[k]:
                    return str(state[k])
        return match.group(0)

    return re.sub(r":([A-Za-z_][A-Za-z0-9_]*)", repl, out)


def has_unresolved_path_params(path: str) -> bool:
    return bool(re.search(r":[A-Za-z_][A-Za-z0-9_]*", path))


def find_by_key(data: Any, key: str) -> str:
    if isinstance(data, dict):
        if key in data and data[key] is not None:
            return str(data[key])
        for v in data.values():
            found = find_by_key(v, key)
            if found:
                return found
    if isinstance(data, list):
        for item in data:
            found = find_by_key(item, key)
            if found:
                return found
    return ""


def api_call(page, *, path: str, method: str = "GET", body: dict | None = None, token: str = "") -> dict:
    return page.evaluate(
        """async ({path, method, body, token}) => {
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = 'Bearer ' + token;
          const init = {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          };
          const r = await fetch(path, init);
          const t = await r.text();
          let j = null;
          try { j = t ? JSON.parse(t) : null; } catch { j = null; }
          return { ok: r.ok, status: r.status, json: j, text: t };
        }""",
        {"path": path, "method": method, "body": body, "token": token},
    )


def api_upload(
    page,
    *,
    path: str,
    fields: dict,
    file_field: str = "file",
    file_name: str = "upload.csv",
    file_content: str = "",
    file_type: str = "text/csv",
    token: str = "",
) -> dict:
    return page.evaluate(
        """async ({path, fields, fileField, fileName, fileContent, fileType, token}) => {
          const blob = new Blob([fileContent], {type: fileType});
          const file = new File([blob], fileName, {type: fileType});
          const fd = new FormData();
          fd.append(fileField, file);
          for (const [k, v] of Object.entries(fields || {})) fd.append(k, String(v));
          const headers = {};
          if (token) headers['Authorization'] = 'Bearer ' + token;
          const r = await fetch(path, { method: 'POST', headers, body: fd });
          const t = await r.text();
          let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
          return { ok: r.ok, status: r.status, json: j, text: t };
        }""",
        {
            "path": path,
            "fields": fields,
            "fileField": file_field,
            "fileName": file_name,
            "fileContent": file_content,
            "fileType": file_type,
            "token": token,
        },
    )


def poll_until(
    page,
    *,
    path: str,
    target: str,
    status_field: str = "status",
    fail_value: str = "FAILED",
    timeout_sec: int = 30,
    interval_sec: int = 2,
    token: str = "",
) -> dict:
    deadline = time.time() + timeout_sec
    last_status = "UNKNOWN"
    last_data: dict = {}
    while time.time() < deadline:
        res = api_call(page, path=path, token=token)
        data = res.get("json") or {}
        if not isinstance(data, dict):
            data = {}
        last_status = str(data.get(status_field, "UNKNOWN"))
        last_data = data
        if last_status == target:
            return {"ok": True, "status": last_status, "data": data}
        if fail_value and last_status == fail_value:
            return {"ok": False, "status": last_status, "data": data}
        time.sleep(interval_sec)
    return {"ok": False, "status": f"TIMEOUT (last: {last_status})", "data": last_data}


def run_plan_step(page, step: dict, state: dict[str, str], token: str) -> tuple[bool, str]:
    kind = str(step.get("kind") or "api")
    method = str(step.get("method") or "GET").upper()
    path = render_path(str(step.get("path") or "/"), state)
    if has_unresolved_path_params(path):
        return True, f"skipped unresolved path params: {path}"

    if kind == "upload":
        fields = render_value(step.get("fields") or {}, state)
        file_content = str(render_value(step.get("file_content") or "name,value\nalpha,10\n", state))
        res = api_upload(
            page,
            path=path,
            fields=fields if isinstance(fields, dict) else {},
            file_field=str(step.get("file_field") or "file"),
            file_name=str(render_value(step.get("file_name") or "upload.csv", state)),
            file_content=file_content,
            file_type=str(step.get("file_type") or "text/csv"),
            token=token,
        )
        status = int(res.get("status") or 0)
        ok = bool(res.get("ok"))
        note = f"status={status}"
        payload = res.get("json")
    elif kind == "poll":
        poll = poll_until(
            page,
            path=path,
            target=str(step.get("target") or "COMPLETED"),
            status_field=str(step.get("status_field") or "status"),
            fail_value=str(step.get("fail_value") or "FAILED"),
            timeout_sec=int(step.get("timeout_sec") or 30),
            interval_sec=int(step.get("interval_sec") or 2),
            token=token,
        )
        ok = bool(poll.get("ok"))
        note = str(poll.get("status"))
        payload = poll.get("data")
    else:
        body = render_value(step.get("body"), state)
        body_dict = body if isinstance(body, dict) else None
        res = api_call(page, path=path, method=method, body=body_dict, token=token)
        status = int(res.get("status") or 0)
        ok = bool(res.get("ok"))
        note = f"status={status}"
        payload = res.get("json")

    if isinstance(payload, dict):
        save_as = str(step.get("save_as") or "")
        candidates = [save_as] if save_as else []
        candidates += [str(k) for k in (step.get("produced_keys") or [])]
        candidates += ["id", "datasetId", "jobId", "analysisId", "token"]
        for key in candidates:
            if not key:
                continue
            value = find_by_key(payload, key)
            if value:
                state[key] = value
                if save_as and key != save_as and save_as not in state:
                    state[save_as] = value
                break
    return ok, note


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

    workflow_plan = read_workflow_plan()
    wf = workflow_plan.get("workflow") if isinstance(workflow_plan, dict) else {}
    core_chain = wf.get("core_chain") if isinstance(wf, dict) else []
    branches = wf.get("branches") if isinstance(wf, dict) else []
    utility_hits = workflow_plan.get("utility_hits") if isinstance(workflow_plan, dict) else []
    cleanup_plan = workflow_plan.get("cleanup") if isinstance(workflow_plan, dict) else []
    skipped_plan = workflow_plan.get("skipped") if isinstance(workflow_plan, dict) else []

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

        token = ""
        try:
            auth = api_call(
                page,
                path="/api/auth/login",
                method="POST",
                body={"email": test_email, "password": test_password},
            )
            auth_json = auth.get("json") if isinstance(auth.get("json"), dict) else {}
            token = str((auth_json or {}).get("token") or "")
            if token:
                log("API token discovery", True, "token acquired")
            else:
                log("API token discovery", True, "cookie auth only")
        except Exception as exc:
            log("API token discovery", True, f"skip: {exc}")

        if mutating:
            suffix = str(int(time.time()))
            state: dict[str, str] = {"ts": suffix}

            if isinstance(core_chain, list) and core_chain:
                for i, step in enumerate(core_chain, start=1):
                    if not isinstance(step, dict):
                        continue
                    name = str(step.get("name") or f"WF Step {i}")
                    try:
                        ok, note = run_plan_step(page, step, state, token)
                        log(f"WF: {name}", ok, note)
                    except Exception as exc:
                        log(f"WF: {name}", False, str(exc))
            else:
                ws = api_call(page, path="/api/workstreams", method="POST", body={"name": f"USE WS {suffix}"}, token=token)
                ws_id = find_by_key(ws.get("json"), "id")
                if ws_id:
                    state["workstreamId"] = ws_id
                log("Create workstream (fallback)", bool(ws.get("ok")) and bool(ws_id), f"status={ws.get('status')} id={ws_id}")

            if isinstance(branches, list):
                for step in branches:
                    if not isinstance(step, dict):
                        continue
                    name = str(step.get("name") or "Branch")
                    try:
                        ok, note = run_plan_step(page, step, state, token)
                        log(f"WF Branch: {name}", ok, note)
                    except Exception as exc:
                        log(f"WF Branch: {name}", False, str(exc))

            if not isinstance(utility_hits, list) or not utility_hits:
                utility_hits = [{"method": "GET", "path": "/api/auth/me"}, {"method": "GET", "path": "/api/stats"}]
            for item in utility_hits:
                if not isinstance(item, dict):
                    continue
                method = str(item.get("method") or "GET").upper()
                path = render_path(str(item.get("path") or "/api/health"), state)
                if has_unresolved_path_params(path):
                    log(f"Utility: {method} {item.get('path')}", True, f"skip unresolved params -> {path}")
                    continue
                try:
                    r = api_call(page, path=path, method=method, token=token)
                    log(f"Utility: {method} {path}", int(r.get("status", 500)) < 500, f"status={r.get('status')}")
                except Exception as exc:
                    log(f"Utility: {method} {path}", False, str(exc))

            if isinstance(cleanup_plan, list):
                for item in cleanup_plan:
                    if not isinstance(item, dict):
                        continue
                    key = str(item.get("state_key") or "")
                    if not key or key not in state:
                        continue
                    path = render_path(str(item.get("path") or ""), state)
                    if not path:
                        continue
                    if has_unresolved_path_params(path):
                        log(f"WF Cleanup: {key}", True, f"skip unresolved params -> {path}")
                        continue
                    method = str(item.get("method") or "DELETE").upper()
                    try:
                        time.sleep(1)
                        r = api_call(page, path=path, method=method, token=token)
                        ok = bool(r.get("ok")) or int(r.get("status") or 0) == 404
                        note = f"status={r.get('status')}"
                        if not ok and bool(item.get("non_critical")):
                            note += " (non-critical)"
                        log(f"WF Cleanup: {key}", ok or bool(item.get("non_critical")), note)
                    except Exception as exc:
                        if bool(item.get("non_critical")):
                            log(f"WF Cleanup: {key}", True, f"non-critical: {exc}")
                        else:
                            log(f"WF Cleanup: {key}", False, str(exc))

            if isinstance(skipped_plan, list):
                for item in skipped_plan:
                    if not isinstance(item, dict):
                        continue
                    method = str(item.get("method") or "GET").upper()
                    raw_path = str(item.get("path") or "")
                    reason = str(item.get("reason") or "unclassified")
                    if raw_path:
                        log(f"Audit Skipped: {method} {raw_path}", True, reason)

        use_paths = prioritize_use_paths(read_paths(), limit=8)
        for path in use_paths:
            try:
                page.goto(f"{base_url}{path}", wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(600)
                log(f"Open {path}", True, page.url)
            except Exception as exc:
                log(f"Open {path}", False, str(exc))
                continue

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
        artifacts={"downloads": downloads, "workflow_plan_loaded": bool(workflow_plan)},
    )
    print(f"Result file: {run_dir / 'result.json'}")


if __name__ == "__main__":
    main()
