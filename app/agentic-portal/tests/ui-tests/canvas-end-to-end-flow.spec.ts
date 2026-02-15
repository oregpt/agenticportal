import { test, expect, Page, APIRequestContext } from '@playwright/test';

type SourceType = 'postgres' | 'bigquery' | 'google_sheets';

type WorkstreamNode = {
  id: string;
  type: 'datasource' | 'view' | 'dashboard' | 'output';
  name: string;
  description?: string;
  parentIds: string[];
  status?: string;
  metadata?: Record<string, unknown>;
};

type WorkstreamResponse = {
  workstream: { id: string; name: string };
  nodes: WorkstreamNode[];
};

type AuthMeResponse = {
  user: {
    id: string;
    organizationId: string;
  };
};

const FLOW_EMAIL = process.env.FLOW_TEST_EMAIL || 'clark@agenticledger.ai';
const FLOW_PASSWORD = process.env.FLOW_TEST_PASSWORD || 'testpassword123';
const FLOW_SOURCE_TYPE = (process.env.FLOW_SOURCE_TYPE || 'postgres') as SourceType;
const VIEW_COUNT = Number(process.env.FLOW_VIEW_COUNT || '5');
const TABLE_LIMIT = Number(process.env.FLOW_TABLE_LIMIT || '5');

const POSTGRES_CONFIG = {
  namePrefix: process.env.FLOW_DS_NAME_PREFIX || 'D7 PG',
  host: process.env.FLOW_PG_HOST || 'shuttle.proxy.rlwy.net',
  port: process.env.FLOW_PG_PORT || '19092',
  database: process.env.FLOW_PG_DATABASE || 'agenticledger_d7',
  username: process.env.FLOW_PG_USERNAME || 'postgres',
  password: process.env.FLOW_PG_PASSWORD || 'iEoCzu_rEw9wLsxEhEGGnB83gf8_iei5',
};

const outputEmail = process.env.FLOW_OUTPUT_EMAIL || FLOW_EMAIL;

const queryPrompts = [
  'Show the latest 25 rows sorted by newest timestamp first',
  'Count total rows grouped by a meaningful status/category column',
  'Show top 20 records by a likely numeric metric',
  'Summarize activity by day for the most recent period',
  'Find potential duplicates by key identifiers and show counts',
  'List null-rate indicators for important columns',
];

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', FLOW_EMAIL);
  await page.fill('input[type="password"]', FLOW_PASSWORD);
  await page.getByRole('button', { name: /^Sign In$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
  await expect(page.getByText(/Workstreams|Dashboard|Chat/i).first()).toBeVisible({ timeout: 45000 });
}

async function createWorkstream(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.post('/api/workstreams', {
    data: {
      name,
      description: 'Automated end-to-end canvas flow',
      color: '#8b5cf6',
    },
  });

  const json = await response.json();
  expect(response.ok(), `Workstream create failed: ${JSON.stringify(json)}`).toBeTruthy();
  return json.workstream.id as string;
}

async function getWorkstreamState(request: APIRequestContext, workstreamId: string): Promise<WorkstreamResponse> {
  const response = await request.get(`/api/workstreams/${workstreamId}`);
  const json = await response.json();
  expect(response.ok(), `Fetch workstream failed: ${JSON.stringify(json)}`).toBeTruthy();
  return json as WorkstreamResponse;
}

async function getDashboardsForWorkstream(
  request: APIRequestContext,
  workstreamId: string
): Promise<Array<{ id: string; name: string }>> {
  const response = await request.get(`/api/dashboards?workstreamId=${encodeURIComponent(workstreamId)}`);
  const json = await response.json();
  expect(response.ok(), `Fetch dashboards failed: ${JSON.stringify(json)}`).toBeTruthy();
  return (json.dashboards || []) as Array<{ id: string; name: string }>;
}

async function getOrganizationId(request: APIRequestContext): Promise<string> {
  const response = await request.get('/api/auth/me');
  const json = (await response.json()) as Partial<AuthMeResponse> & { error?: string };
  expect(response.ok(), `Auth me failed: ${JSON.stringify(json)}`).toBeTruthy();
  expect(json.user?.organizationId, 'Missing organizationId on /api/auth/me').toBeTruthy();
  return json.user!.organizationId;
}

async function refreshDatasourceSchema(
  request: APIRequestContext,
  datasourceId: string,
  organizationId: string
): Promise<void> {
  const response = await request.get(
    `/api/datasources/${datasourceId}/schema?organizationId=${encodeURIComponent(organizationId)}&refresh=true`
  );
  const json = await response.json();
  expect(response.ok(), `Datasource schema refresh failed: ${JSON.stringify(json)}`).toBeTruthy();
}

async function openConnectModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Connect Data Source|Connect Source/i }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Connect Data Source');
}

async function connectPostgresFromCanvas(page: Page): Promise<void> {
  await page.getByRole('button', { name: /PostgreSQL/i }).click();

  const dialog = page.getByRole('dialog');
  const inputs = dialog.locator('input');

  await inputs.nth(0).fill(`${POSTGRES_CONFIG.namePrefix} ${Date.now().toString().slice(-5)}`);
  await inputs.nth(1).fill(POSTGRES_CONFIG.host);
  await inputs.nth(2).fill(POSTGRES_CONFIG.port);
  await inputs.nth(3).fill(POSTGRES_CONFIG.database);
  await inputs.nth(4).fill(POSTGRES_CONFIG.username);
  await inputs.nth(5).fill(POSTGRES_CONFIG.password);

  await dialog.getByRole('button', { name: /Test & Select Tables/i }).click();

  await expect(dialog.getByText(/Connected! Found \d+ tables\./i, { exact: false })).toBeVisible({ timeout: 60000 });
  await expect(dialog.getByText(/\d+ of \d+ tables selected/i)).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: /Connect with \d+ Tables/i }).click();
  await expect(dialog).toBeHidden({ timeout: 45000 });
}

async function createAIViewForTable(page: Page, tableName: string, prompt: string): Promise<void> {
  await page.getByRole('button', { name: /^Create View$/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Create View with AI');

  const tableCountLabel = dialog.getByText(/Select Table \(\d+ of \d+\)/i);
  await expect(tableCountLabel).toBeVisible({ timeout: 45000 });

  const searchInput = dialog.getByPlaceholder('Type to filter tables...');
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(tableName);
  }

  const exactTableButton = dialog.locator('button').filter({ hasText: tableName }).first();
  if (await exactTableButton.isVisible().catch(() => false)) {
    await exactTableButton.click();
  } else {
    await dialog
      .locator('button')
      .filter({ has: dialog.locator('svg.lucide-table2') })
      .first()
      .click();
  }
  await dialog.getByRole('button', { name: /Continue with/i }).click();

  await dialog.locator('textarea').fill(prompt);
  await dialog.getByRole('button', { name: /Generate View/i }).click();

  await expect(dialog).toBeHidden({ timeout: 90000 });
}

async function createDashboard(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /^Create Dashboard$/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Create Dashboard');

  await dialog.getByPlaceholder(/Weekly Metrics Dashboard/i).fill(name);

  const checkboxes = dialog.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  expect(count, 'No views available to build dashboard').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const checked = await checkboxes.nth(i).isChecked();
    if (!checked) {
      await checkboxes.nth(i).check();
    }
  }

  await dialog.getByRole('button', { name: /Create Dashboard/i }).click();
  await expect(dialog).toBeHidden({ timeout: 45000 });
}

async function createOutput(page: Page, name: string, dashboardName: string): Promise<void> {
  await page.getByRole('button', { name: /^Add Output$/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Add Output');

  await dialog.getByRole('button', { name: /Email Report/i }).click();

  await dialog.getByPlaceholder(/Weekly Report Email/i).fill(name);

  const createButton = dialog.getByRole('button', { name: /Create Output/i });
  if (await createButton.isDisabled()) {
    const nativeSelects = dialog.locator('select');
    if ((await nativeSelects.count()) >= 1) {
      const optionCount = await nativeSelects.first().locator('option').count();
      if (optionCount > 1) {
        await nativeSelects.first().selectOption({ label: dashboardName }).catch(async () => {
          await nativeSelects.first().selectOption({ index: 1 });
        });
      }
      if ((await nativeSelects.count()) >= 2) {
        await nativeSelects.nth(1).selectOption('daily').catch(async () => {});
      }
    } else {
      const selectors = dialog.getByRole('combobox');
      if (await selectors.count()) {
        await selectors.first().click();
        const options = dialog.getByRole('option');
        if (await options.count()) {
          if (await dialog.getByRole('option', { name: dashboardName }).count()) {
            await dialog.getByRole('option', { name: dashboardName }).first().click();
          } else {
            await options.first().click();
          }
        }
      }
    }
  }
  await dialog.getByPlaceholder('team@company.com').fill(outputEmail);

  await createButton.click();
  await expect(dialog).toBeHidden({ timeout: 45000 });
}

async function assertSidePanelForNode(page: Page, nodeName: string, expectedTypeLabel: string): Promise<void> {
  await page.locator('h4', { hasText: nodeName }).first().click();
  const sidebar = page.locator('div.w-80.border-l.border-gray-200.bg-white').last();
  await expect(
    sidebar.locator('p.text-xs.text-gray-500.uppercase.tracking-wider', { hasText: expectedTypeLabel }).first()
  ).toBeVisible({ timeout: 10000 });
  await expect(sidebar.getByRole('button', { name: /View Details/i })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /Refresh/i })).toBeVisible();
  await sidebar.getByRole('button').filter({ has: page.locator('svg.lucide-x') }).click();
}

async function addDashboardWidgets(page: Page): Promise<void> {
  const widgetTypes = [
    { typeName: 'Table', title: uid('Auto Table Widget') },
    { typeName: 'Bar Chart', title: uid('Auto Bar Chart') },
    { typeName: 'Line Chart', title: uid('Auto Line Chart') },
    { typeName: 'Area Chart', title: uid('Auto Area Chart') },
    { typeName: 'Pie Chart', title: uid('Auto Pie Chart') },
  ];

  for (const widget of widgetTypes) {
    await page.getByRole('button', { name: /^Add Widget$/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/Monthly Revenue/i).fill(widget.title);
    await dialog.locator('button').filter({ hasText: widget.typeName }).first().click();
    await dialog.getByRole('button', { name: /^Add Widget$/i }).click();
    await expect(page.getByText(widget.title)).toBeVisible({ timeout: 20000 });
  }
}

async function runChat(page: Page, datasourceName: string, tableName: string): Promise<void> {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: datasourceName }).click();

  const prompt = `Using only table ${tableName}, show me a quick count and 10 sample rows.`;
  await page.locator('textarea').fill(prompt);
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-send') }).click();

  await expect(page.getByText('Generated SQL')).toBeVisible({ timeout: 90000 });
}

test.describe('Canvas End-to-End Flow Template', () => {
  test.setTimeout(15 * 60 * 1000);

  test('postgres end-to-end from canvas to chat', async ({ page }) => {
    test.skip(FLOW_SOURCE_TYPE !== 'postgres', 'Current canvas modal only supports postgres config flow.');

    await login(page);

    const workstreamName = uid('E2E Workstream');
    const workstreamId = await createWorkstream(page.request, workstreamName);

    await page.goto(`/workstream-canvas/${workstreamId}`);
    await page.waitForLoadState('networkidle');

    await openConnectModal(page);
    await connectPostgresFromCanvas(page);

    await expect.poll(async () => {
      const state = await getWorkstreamState(page.request, workstreamId);
      return state.nodes.filter((n) => n.type === 'datasource').length;
    }, { timeout: 60000 }).toBe(1);

    const organizationId = await getOrganizationId(page.request);
    const stateAfterSource = await getWorkstreamState(page.request, workstreamId);
    const datasourceNode = stateAfterSource.nodes.find((n) => n.type === 'datasource');
    expect(datasourceNode).toBeTruthy();

    await refreshDatasourceSchema(page.request, datasourceNode!.id, organizationId);

    await expect.poll(async () => {
      const refreshed = await getWorkstreamState(page.request, workstreamId);
      const ds = refreshed.nodes.find((n) => n.type === 'datasource');
      const md = (ds?.metadata || {}) as { schemaCache?: { tables?: Array<{ name: string }> } };
      return md.schemaCache?.tables?.length || 0;
    }, { timeout: 120000 }).toBeGreaterThan(0);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const stateAfterSchemaRefresh = await getWorkstreamState(page.request, workstreamId);
    const refreshedDatasourceNode = stateAfterSchemaRefresh.nodes.find((n) => n.type === 'datasource');
    expect(refreshedDatasourceNode).toBeTruthy();

    const metadata = (refreshedDatasourceNode?.metadata || {}) as { schemaCache?: { tables?: Array<{ name: string }> } };
    const tableNames = (metadata.schemaCache?.tables || []).slice(0, VIEW_COUNT).map((t) => t.name);
    expect(tableNames.length, 'Need at least one table after datasource connect').toBeGreaterThan(0);

    for (let i = 0; i < tableNames.length; i++) {
      const table = tableNames[i];
      const prompt = `${queryPrompts[i % queryPrompts.length]} from ${table}`;
      await createAIViewForTable(page, table, prompt);
    }

    await expect.poll(async () => {
      const state = await getWorkstreamState(page.request, workstreamId);
      return state.nodes.filter((n) => n.type === 'view').length;
    }, { timeout: 5 * 60 * 1000 }).toBe(tableNames.length);

    const dashboardName = uid('E2E Dashboard');
    await createDashboard(page, dashboardName);

    await expect.poll(async () => {
      const state = await getWorkstreamState(page.request, workstreamId);
      return state.nodes.filter((n) => n.type === 'dashboard').length;
    }, { timeout: 60000 }).toBe(1);

    const outputName = uid('E2E Output');
    await createOutput(page, outputName, dashboardName);

    await expect.poll(async () => {
      const state = await getWorkstreamState(page.request, workstreamId);
      return state.nodes.filter((n) => n.type === 'output').length;
    }, { timeout: 60000 }).toBe(1);

    const stateAfterAll = await getWorkstreamState(page.request, workstreamId);
    const firstDataSource = stateAfterAll.nodes.find((n) => n.type === 'datasource');
    const firstView = stateAfterAll.nodes.find((n) => n.type === 'view');
    const firstDashboard = stateAfterAll.nodes.find((n) => n.type === 'dashboard');
    const firstOutput = stateAfterAll.nodes.find((n) => n.type === 'output');

    expect(firstDataSource && firstView && firstDashboard && firstOutput).toBeTruthy();

    await assertSidePanelForNode(page, firstDataSource!.name, 'Data Source');
    await assertSidePanelForNode(page, firstView!.name, 'View');
    await assertSidePanelForNode(page, firstDashboard!.name, 'Dashboard');
    await assertSidePanelForNode(page, firstOutput!.name, 'Output');

    await expect
      .poll(async () => (await getDashboardsForWorkstream(page.request, workstreamId)).length, { timeout: 30000 })
      .toBeGreaterThan(0);
    const dashboardsForWorkstream = await getDashboardsForWorkstream(page.request, workstreamId);
    const widgetDashboardId = dashboardsForWorkstream[0]!.id;

    await page.goto(`/dashboards/${widgetDashboardId}`);
    await expect(page.getByRole('button', { name: /^Add Widget$/i })).toBeVisible({ timeout: 20000 });

    await addDashboardWidgets(page);

    await runChat(page, firstDataSource!.name, tableNames[0]!);
  });
});
