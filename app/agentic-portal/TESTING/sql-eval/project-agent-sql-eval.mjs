#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
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

function requireValue(value, name) {
  if (!value) {
    throw new Error(`Missing required value: ${name}`);
  }
  return value;
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

async function loadPrompts(promptsFile) {
  if (!promptsFile) {
    return [
      'Give me top 20 rows with all columns and explain what this table appears to represent.',
      'What are the top 10 categories by total amount? Return category and total.',
      'Show a monthly trend for the last 12 months with count and total value.',
      'Find anomalies or outliers and explain why they stand out.',
      'Give me 3 business insights from this source with supporting SQL-ready metrics.',
    ];
  }

  const absolute = toAbsoluteMaybe(promptsFile);
  const raw = await fs.readFile(absolute, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((p) => typeof p !== 'string')) {
    throw new Error('Prompts file must be a JSON array of strings');
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv);

  const baseUrl = requireValue(args.baseUrl || process.env.BASE_URL, 'baseUrl / BASE_URL');
  const email = requireValue(args.email || process.env.USER_EMAIL, 'email / USER_EMAIL');
  const password = requireValue(args.password || process.env.USER_PASSWORD, 'password / USER_PASSWORD');
  const projectIdArg = args.projectId || process.env.PROJECT_ID || '';
  const projectNameArg = args.projectName || process.env.PROJECT_NAME || '';
  const sourceIdArg = args.sourceId || process.env.SOURCE_ID || '';
  const perSourceLimit = Math.max(1, Number(args.maxPromptsPerSource || process.env.MAX_PROMPTS_PER_SOURCE || 200));
  const totalRunsTarget = Math.max(0, Number(args.totalRuns || process.env.TOTAL_RUNS || 0));
  const outputPath = toAbsoluteMaybe(args.out || process.env.OUT_FILE || 'tmp/project-agent-sql-eval.json');

  const prompts = await loadPrompts(args.promptsFile || process.env.PROMPTS_FILE);

  console.log(`[sql-eval] Login: ${baseUrl}`);
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

  const projectsRes = await api({ baseUrl, pathName: '/api/project-agent/projects', cookie });
  const projects = Array.isArray(projectsRes.payload?.projects) ? projectsRes.payload.projects : [];
  if (!projects.length) throw new Error('No project-agent projects available for this user/org');

  const project =
    (projectIdArg ? projects.find((p) => String(p.id) === String(projectIdArg)) : null) ||
    (projectNameArg ? projects.find((p) => String(p.name).toLowerCase() === String(projectNameArg).toLowerCase()) : null) ||
    projects[0];

  const projectId = String(project.id);
  console.log(`[sql-eval] Project: ${project.name} (${projectId})`);

  const sourcesRes = await api({
    baseUrl,
    pathName: `/api/project-agent/sources?projectId=${encodeURIComponent(projectId)}`,
    cookie,
  });

  const allSources = Array.isArray(sourcesRes.payload?.sources) ? sourcesRes.payload.sources : [];
  const activeSources = allSources.filter((s) => String(s.status || 'active') !== 'disabled');
  const sources = sourceIdArg ? activeSources.filter((s) => String(s.id) === String(sourceIdArg)) : activeSources;

  if (!sources.length) {
    throw new Error(sourceIdArg ? `Source not found or disabled: ${sourceIdArg}` : 'No active sources found for project');
  }

  console.log(`[sql-eval] Sources: ${sources.map((s) => `${s.name} (${s.id})`).join(', ')}`);

  const startedAt = new Date().toISOString();
  const runs = [];
  const plan = [];
  if (totalRunsTarget > 0) {
    for (let i = 0; i < totalRunsTarget; i++) {
      const source = sources[i % sources.length];
      const prompt = prompts[i % prompts.length];
      plan.push({
        sourceId: String(source.id),
        sourceName: String(source.name || source.id),
        prompt,
        promptIndex: i % prompts.length,
        runIndex: i + 1,
      });
    }
  } else {
    for (const source of sources) {
      for (let i = 0; i < Math.min(prompts.length, perSourceLimit); i++) {
        plan.push({
          sourceId: String(source.id),
          sourceName: String(source.name || source.id),
          prompt: prompts[i],
          promptIndex: i,
          runIndex: plan.length + 1,
        });
      }
    }
  }

  for (const item of plan) {
    const runStarted = Date.now();
    try {
      const chatRes = await api({
        baseUrl,
        pathName: '/api/project-agent/chat',
        method: 'POST',
        cookie,
        body: { projectId, sourceId: item.sourceId, message: item.prompt },
      });

      const trust = chatRes.payload?.trust || {};
      runs.push({
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        promptIndex: item.promptIndex,
        prompt: item.prompt,
        ok: true,
        latencyMs: Date.now() - runStarted,
        rowCount: Number(trust?.rowCount || 0),
        confidence: trust?.confidence ?? null,
        sql: String(trust?.sql || ''),
        answer: String(chatRes.payload?.answer || ''),
        error: null,
      });

      console.log(
        `[sql-eval] OK run=${item.runIndex}/${plan.length} source=${item.sourceName} prompt=${item.promptIndex + 1} rows=${Number(trust?.rowCount || 0)}`
      );
    } catch (err) {
      runs.push({
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        promptIndex: item.promptIndex,
        prompt: item.prompt,
        ok: false,
        latencyMs: Date.now() - runStarted,
        rowCount: 0,
        confidence: null,
        sql: String(err?.response?.trust?.sql || ''),
        answer: '',
        error: err?.message || 'Unknown error',
      });
      console.log(
        `[sql-eval] FAIL run=${item.runIndex}/${plan.length} source=${item.sourceName} prompt=${item.promptIndex + 1} error=${err?.message || 'Unknown error'}`
      );
    }
  }

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    projectId,
    projectName: String(project.name || projectId),
    sourcesTested: sources.length,
    promptsPerSource: totalRunsTarget > 0 ? null : Math.min(prompts.length, perSourceLimit),
    totalRunsTarget: totalRunsTarget || null,
    totalRuns: runs.length,
    successCount: runs.filter((r) => r.ok).length,
    failureCount: runs.filter((r) => !r.ok).length,
    avgLatencyMs: runs.length
      ? Math.round(runs.reduce((acc, row) => acc + Number(row.latencyMs || 0), 0) / runs.length)
      : 0,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ summary, runs }, null, 2));

  console.log('[sql-eval] Done');
  console.log(`[sql-eval] Summary: ${summary.successCount}/${summary.totalRuns} successful`);
  console.log(`[sql-eval] Output: ${outputPath}`);
}

main().catch((error) => {
  console.error('[sql-eval] Fatal:', error?.message || error);
  process.exit(1);
});
