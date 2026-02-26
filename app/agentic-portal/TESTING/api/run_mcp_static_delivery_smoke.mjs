const baseUrl = String(process.env.BASE_URL || 'https://agenticportal.agenticledger.ai').trim();
const email = String(process.env.TEST_EMAIL || '').trim();
const password = String(process.env.TEST_PASSWORD || '').trim();
const recipientEmail = String(process.env.DELIVERY_RECIPIENT || email).trim();
const explicitProjectId = String(process.env.PROJECT_ID || '').trim();
const explicitSourceId = String(process.env.SOURCE_ID || '').trim();

if (!email || !password) {
  console.error('Missing TEST_EMAIL or TEST_PASSWORD');
  process.exit(1);
}

function parseCookie(setCookie) {
  if (!setCookie) return '';
  return String(setCookie).split(';')[0] || '';
}

async function api(path, { method = 'GET', cookie = '', body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload };
}

async function resolveProjectAndSource(cookie) {
  if (explicitProjectId && explicitSourceId) {
    return { projectId: explicitProjectId, sourceId: explicitSourceId, projectName: explicitProjectId, sourceName: explicitSourceId };
  }

  const projectsRes = await api('/api/project-agent/projects', { cookie });
  if (!projectsRes.ok) throw new Error(`Failed to list projects: ${projectsRes.payload?.error || projectsRes.status}`);
  const projects = Array.isArray(projectsRes.payload?.projects) ? projectsRes.payload.projects : [];
  if (!projects.length) throw new Error('No project-agent projects found');

  for (const project of projects) {
    const srcRes = await api(`/api/project-agent/sources?projectId=${encodeURIComponent(project.id)}`, { cookie });
    if (!srcRes.ok) continue;
    const sources = Array.isArray(srcRes.payload?.sources) ? srcRes.payload.sources : [];
    const source = sources.find(
      (s) => String(s.type) === 'mcp_server' && String(s.mcpProvider || '') === 'lighthouse' && String(s.status || 'active') !== 'disabled'
    );
    if (source) {
      return {
        projectId: String(project.id),
        sourceId: String(source.id),
        projectName: String(project.name || project.id),
        sourceName: String(source.name || source.id),
      };
    }
  }
  throw new Error('No active Lighthouse MCP source found');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const out = {
    login: null,
    selection: null,
    chat: null,
    saveTable: null,
    artifactRun: null,
    deliveryCreate: null,
    deliveryRun: null,
    cleanup: { deletedDelivery: null, deletedArtifact: null },
    notes: [],
  };

  let cookie = '';
  let artifactId = '';
  let deliveryChannelId = '';

  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginPayload = await loginRes.json().catch(() => ({}));
    cookie = parseCookie(loginRes.headers.get('set-cookie'));
    out.login = { ok: loginRes.ok, status: loginRes.status, hasCookie: Boolean(cookie), user: loginPayload?.user || null };
    assert(loginRes.ok && cookie, `Login failed: ${loginPayload?.error || loginRes.status}`);

    const selection = await resolveProjectAndSource(cookie);
    out.selection = selection;

    const chatRes = await api('/api/project-agent/chat', {
      method: 'POST',
      cookie,
      body: {
        projectId: selection.projectId,
        sourceId: selection.sourceId,
        message: 'Show overall Canton network statistics from Lighthouse.',
      },
    });
    const sampleRows = Array.isArray(chatRes.payload?.trust?.sampleRows) ? chatRes.payload.trust.sampleRows : [];
    out.chat = {
      ok: chatRes.ok,
      status: chatRes.status,
      sql: chatRes.payload?.trust?.sql || null,
      rowCount: Number(chatRes.payload?.trust?.rowCount || 0),
      sampleRowsCount: sampleRows.length,
      sampleRowKeys: sampleRows[0] && typeof sampleRows[0] === 'object' ? Object.keys(sampleRows[0]).slice(0, 12) : [],
      artifactActions: chatRes.payload?.artifactActions || null,
      error: chatRes.payload?.error || null,
    };
    assert(chatRes.ok, `Chat failed: ${chatRes.payload?.error || chatRes.status}`);
    assert(Boolean(out.chat.sql), 'Chat did not return sql/trust payload');
    assert(sampleRows.length > 0, 'Chat did not return sample rows');
    assert((out.chat.sampleRowKeys || []).length > 1, 'Sample rows appear empty/placeholder');

    const saveRes = await api('/api/project-agent/chat/save-table', {
      method: 'POST',
      cookie,
      body: {
        projectId: selection.projectId,
        sourceId: selection.sourceId,
        sqlText: out.chat.sql,
        name: `MCP Smoke ${Date.now()}`,
        metadataJson: {
          rowCount: out.chat.rowCount,
          sampleRows,
          sourceType: 'mcp_server',
        },
      },
    });
    artifactId = String(saveRes.payload?.artifact?.id || '');
    out.saveTable = { ok: saveRes.ok, status: saveRes.status, artifactId: artifactId || null, error: saveRes.payload?.error || null };
    assert(saveRes.ok && artifactId, `Save table failed: ${saveRes.payload?.error || saveRes.status}`);

    const runRes = await api(`/api/artifacts/${encodeURIComponent(artifactId)}/run`, {
      method: 'POST',
      cookie,
      body: { triggerType: 'manual' },
    });
    out.artifactRun = {
      ok: runRes.ok,
      status: runRes.status,
      runId: runRes.payload?.run?.id || null,
      runStatus: runRes.payload?.run?.status || null,
      sampleCount: Array.isArray(runRes.payload?.run?.resultSampleJson) ? runRes.payload.run.resultSampleJson.length : 0,
      error: runRes.payload?.error || runRes.payload?.run?.errorText || null,
    };
    assert(runRes.ok, `Artifact run failed: ${out.artifactRun.error || runRes.status}`);

    const deliveryRes = await api('/api/delivery/channels', {
      method: 'POST',
      cookie,
      body: {
        projectId: selection.projectId,
        artifactId,
        name: `MCP Smoke Delivery ${Date.now()}`,
        channelType: 'email',
        deliveryMode: 'on_demand',
        isEnabled: true,
        configJson: {
          email: { recipients: [recipientEmail], subject: 'MCP smoke delivery', includeCsvAttachment: true },
          mcp: { mode: 'snapshot', fallbackToSnapshotOnFailure: false },
          messageTemplate: 'MCP smoke delivery run',
        },
      },
    });
    deliveryChannelId = String(deliveryRes.payload?.channel?.id || '');
    out.deliveryCreate = { ok: deliveryRes.ok, status: deliveryRes.status, channelId: deliveryChannelId || null, error: deliveryRes.payload?.error || null };
    assert(deliveryRes.ok && deliveryChannelId, `Delivery create failed: ${deliveryRes.payload?.error || deliveryRes.status}`);

    const runDeliveryRes = await api(`/api/delivery/channels/${encodeURIComponent(deliveryChannelId)}/run`, {
      method: 'POST',
      cookie,
    });
    out.deliveryRun = {
      ok: runDeliveryRes.ok,
      status: runDeliveryRes.status,
      hasResult: Boolean(runDeliveryRes.payload?.result),
      resultRunId: runDeliveryRes.payload?.result?.run?.id || null,
      error: runDeliveryRes.payload?.error || null,
    };
    assert(runDeliveryRes.ok, `Delivery run failed: ${runDeliveryRes.payload?.error || runDeliveryRes.status}`);
  } catch (error) {
    out.notes.push(String(error?.message || error));
  } finally {
    if (cookie && deliveryChannelId) {
      const delDelivery = await api(`/api/delivery/channels/${encodeURIComponent(deliveryChannelId)}`, { method: 'DELETE', cookie });
      out.cleanup.deletedDelivery = { ok: delDelivery.ok, status: delDelivery.status, error: delDelivery.payload?.error || null };
    }
    if (cookie && artifactId) {
      const delArtifact = await api(`/api/artifacts/${encodeURIComponent(artifactId)}`, { method: 'DELETE', cookie });
      out.cleanup.deletedArtifact = { ok: delArtifact.ok, status: delArtifact.status, error: delArtifact.payload?.error || null };
    }
    console.log(JSON.stringify(out, null, 2));
  }

  if (out.notes.length) process.exit(1);
})();

