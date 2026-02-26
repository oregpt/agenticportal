import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const testingDir = path.dirname(__filename);
const repoDir = path.resolve(testingDir, '..');
const reportsDir = path.join(testingDir, 'reports');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resolvePythonExecutable() {
  if (process.env.HARNESS_PYTHON && process.env.HARNESS_PYTHON.trim()) {
    return process.env.HARNESS_PYTHON.trim();
  }
  const venvPy = path.join(repoDir, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPy)) return venvPy;
  return 'python';
}

function runCommand({ name, command, args }) {
  const startedAt = new Date().toISOString();
  const res = spawnSync(command, args, {
    cwd: repoDir,
    env: process.env,
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const endedAt = new Date().toISOString();
  return {
    name,
    command,
    args,
    exitCode: typeof res.status === 'number' ? res.status : 1,
    startedAt,
    endedAt,
    stdout: String(res.stdout || ''),
    stderr: String(res.stderr || ''),
  };
}

function parseApiSmoke(stdout) {
  const first = stdout.indexOf('{');
  const last = stdout.lastIndexOf('}');
  if (first < 0 || last < 0 || last <= first) return null;
  try {
    return JSON.parse(stdout.slice(first, last + 1));
  } catch {
    return null;
  }
}

function parseResultFileFromStdout(stdout) {
  const match = stdout.match(/Result file:\s*(.+result\.json)/i);
  if (!match) return null;
  return match[1]?.trim() || null;
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function summarizeStepResult(name, rawStep, parsedResult) {
  if (name === 'api_smoke') {
    const notes = Array.isArray(parsedResult?.notes) ? parsedResult.notes : [];
    const passed = rawStep.exitCode === 0 && notes.length === 0;
    return {
      name,
      passed,
      exitCode: rawStep.exitCode,
      notes,
      details: {
        chatOk: parsedResult?.chat?.ok === true,
        saveOk: parsedResult?.saveTable?.ok === true,
        runOk: parsedResult?.artifactRun?.ok === true,
        deliveryOk: parsedResult?.deliveryRun?.ok === true,
      },
    };
  }

  const steps = Array.isArray(parsedResult?.steps) ? parsedResult.steps : [];
  const passedCount = steps.filter((s) => s?.passed === true).length;
  const failed = steps.filter((s) => s?.passed !== true).map((s) => ({
    name: s?.name || 'unknown',
    note: s?.note || '',
  }));

  return {
    name,
    passed: rawStep.exitCode === 0 && failed.length === 0,
    exitCode: rawStep.exitCode,
    totalChecks: steps.length,
    passedChecks: passedCount,
    failedChecks: failed,
  };
}

function main() {
  ensureDir(reportsDir);
  const python = resolvePythonExecutable();

  const executed = [];

  const api = runCommand({
    name: 'api_smoke',
    command: 'node',
    args: ['TESTING/api/run_mcp_static_delivery_smoke.mjs'],
  });
  executed.push(api);

  const smoke = runCommand({
    name: 'ui_smoke',
    command: python,
    args: ['TESTING/webapp-harness/run_smoke_test.py'],
  });
  executed.push(smoke);

  const use = runCommand({
    name: 'ui_use',
    command: python,
    args: ['TESTING/webapp-harness/run_use_test.py'],
  });
  executed.push(use);

  const apiParsed = parseApiSmoke(api.stdout);
  const smokePath = parseResultFileFromStdout(smoke.stdout);
  const usePath = parseResultFileFromStdout(use.stdout);
  const smokeParsed = smokePath ? loadJson(smokePath) : null;
  const useParsed = usePath ? loadJson(usePath) : null;

  const summarySteps = [
    summarizeStepResult('api_smoke', api, apiParsed),
    summarizeStepResult('ui_smoke', smoke, smokeParsed),
    summarizeStepResult('ui_use', use, useParsed),
  ];

  const passed = summarySteps.every((s) => s.passed === true);
  const report = {
    startedAt: executed[0]?.startedAt || new Date().toISOString(),
    endedAt: new Date().toISOString(),
    passed,
    environment: {
      baseUrl: process.env.BASE_URL || 'https://agenticportal.agenticledger.ai',
      testEmail: process.env.TEST_EMAIL || null,
      pythonExecutable: python,
    },
    steps: summarySteps,
    artifacts: {
      apiRawJson: apiParsed,
      uiSmokeResultFile: smokePath,
      uiUseResultFile: usePath,
    },
    raw: executed.map((step) => ({
      name: step.name,
      exitCode: step.exitCode,
      stderrTail: step.stderr.slice(-4000),
      stdoutTail: step.stdout.slice(-4000),
    })),
  };

  const reportFile = path.join(reportsDir, `regression-${timestamp}.json`);
  const latestFile = path.join(reportsDir, 'latest.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(latestFile, JSON.stringify(report, null, 2), 'utf-8');

  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] Regression report: ${reportFile}`);
  console.log(`Latest: ${latestFile}`);

  if (!passed) process.exit(1);
}

main();

