#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function toAbsoluteMaybe(filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function parseCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  return String(setCookieHeader).split(';')[0] || '';
}

async function api({ baseUrl, pathName, method = 'GET', cookie = '', body }) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.response = payload;
    error.status = response.status;
    throw error;
  }

  return { payload, response };
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = args.baseUrl || process.env.BASE_URL;
  const email = args.email || process.env.USER_EMAIL;
  const password = args.password || process.env.USER_PASSWORD;
  const inputPath = toAbsoluteMaybe(
    args.input || process.env.INPUT_FILE || 'TESTING/sql-eval/e2e-sql-eval-100.json'
  );
  const outputPath = toAbsoluteMaybe(
    args.out || process.env.OUT_FILE || 'TESTING/sql-eval/e2e-sql-eval-failed-replay.json'
  );

  if (!baseUrl || !email || !password) {
    throw new Error('Missing BASE_URL/USER_EMAIL/USER_PASSWORD (or --baseUrl/--email/--password)');
  }

  const raw = await fs.readFile(inputPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const failed = (parsed.runs || []).filter((run) => !run.ok);
  const projectId = String(parsed?.summary?.projectId || '');
  if (!projectId) throw new Error('Input file missing summary.projectId');
  if (!failed.length) throw new Error('Input file has no failed runs to replay');

  console.log(`[failed-replay] Login: ${baseUrl}`);
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginPayload = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginPayload?.error || loginRes.statusText}`);
  }
  const cookie = parseCookie(loginRes.headers.get('set-cookie'));
  if (!cookie) throw new Error('Login succeeded but no session cookie returned');

  console.log(`[failed-replay] Replaying ${failed.length} failed runs for project ${projectId}`);
  const replay = [];
  for (let i = 0; i < failed.length; i += 1) {
    const item = failed[i];
    const started = Date.now();
    try {
      const chatRes = await api({
        baseUrl,
        pathName: '/api/project-agent/chat',
        method: 'POST',
        cookie,
        body: {
          projectId,
          sourceId: String(item.sourceId),
          message: String(item.prompt),
        },
      });
      const trust = chatRes.payload?.trust || {};
      replay.push({
        index: i + 1,
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        promptIndex: item.promptIndex,
        prompt: item.prompt,
        previousError: item.error || null,
        ok: true,
        latencyMs: Date.now() - started,
        rowCount: Number(trust.rowCount || 0),
        confidence: trust.confidence ?? null,
        sql: String(trust.sql || ''),
        answer: String(chatRes.payload?.answer || ''),
        error: null,
      });
      console.log(`[failed-replay] OK ${i + 1}/${failed.length} source=${item.sourceName} prompt=${item.promptIndex + 1}`);
    } catch (err) {
      replay.push({
        index: i + 1,
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        promptIndex: item.promptIndex,
        prompt: item.prompt,
        previousError: item.error || null,
        ok: false,
        latencyMs: Date.now() - started,
        rowCount: 0,
        confidence: null,
        sql: String(err?.response?.trust?.sql || ''),
        answer: '',
        error: err?.message || 'Unknown error',
      });
      console.log(`[failed-replay] FAIL ${i + 1}/${failed.length} source=${item.sourceName} prompt=${item.promptIndex + 1} error=${err?.message || 'Unknown error'}`);
    }
  }

  const summary = {
    startedAt: new Date().toISOString(),
    inputPath,
    outputPath,
    projectId,
    replayedCount: replay.length,
    successCount: replay.filter((r) => r.ok).length,
    failureCount: replay.filter((r) => !r.ok).length,
    avgLatencyMs: replay.length
      ? Math.round(replay.reduce((acc, row) => acc + Number(row.latencyMs || 0), 0) / replay.length)
      : 0,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ summary, replay }, null, 2));
  console.log(`[failed-replay] Summary: ${summary.successCount}/${summary.replayedCount} successful`);
  console.log(`[failed-replay] Output: ${outputPath}`);
}

main().catch((error) => {
  console.error('[failed-replay] Fatal:', error?.message || error);
  process.exit(1);
});
