import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

let bootPromise: Promise<void> | null = null;

export async function ensureProjectAgentTables(): Promise<void> {
  if (!bootPromise) {
    bootPromise = bootstrap();
  }
  return bootPromise;
}

async function bootstrap(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_agents (
      project_id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      agent_name VARCHAR(255),
      default_model VARCHAR(128) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
      instructions TEXT,
      features JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await db.execute(sql`ALTER TABLE project_agents ADD COLUMN IF NOT EXISTS instructions TEXT`).catch(() => {});
  await db.execute(sql`ALTER TABLE project_agents ADD COLUMN IF NOT EXISTS agent_name VARCHAR(255)`).catch(() => {});

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_agent_source_meta (
      source_id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      organization_id VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      user_notes TEXT,
      inferred_notes TEXT,
      last_synced_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_data_query_runs (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      organization_id VARCHAR(64) NOT NULL,
      source_id VARCHAR(64),
      workflow_id VARCHAR(64),
      workflow_run_id VARCHAR(64),
      run_type VARCHAR(32) NOT NULL DEFAULT 'chat',
      message TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'succeeded',
      sql_text TEXT,
      row_count INTEGER NOT NULL DEFAULT 0,
      confidence VARCHAR(32),
      reasoning TEXT,
      answer TEXT,
      result_sample JSONB,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      completed_at TIMESTAMP
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_data_memory_rules (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      organization_id VARCHAR(64) NOT NULL,
      source_id VARCHAR(64),
      name VARCHAR(255) NOT NULL,
      rule_text TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 100,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_data_workflows (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      organization_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      definition JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_data_workflow_runs (
      id VARCHAR(64) PRIMARY KEY,
      workflow_id VARCHAR(64) NOT NULL,
      project_id VARCHAR(64) NOT NULL,
      organization_id VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'running',
      triggered_by VARCHAR(32) NOT NULL DEFAULT 'manual',
      input JSONB,
      output JSONB,
      error TEXT,
      started_at TIMESTAMP DEFAULT NOW() NOT NULL,
      completed_at TIMESTAMP
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_platform_settings (
      key VARCHAR(128) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS query_specs (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      project_id VARCHAR(64) NOT NULL,
      source_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      sql_text TEXT NOT NULL,
      parameters_json JSONB,
      metadata_json JSONB,
      created_by VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS artifacts (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      project_id VARCHAR(64) NOT NULL,
      type VARCHAR(32) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      latest_version INTEGER NOT NULL DEFAULT 1,
      created_by VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS artifact_versions (
      id VARCHAR(64) PRIMARY KEY,
      artifact_id VARCHAR(64) NOT NULL,
      version INTEGER NOT NULL,
      query_spec_id VARCHAR(64),
      config_json JSONB,
      layout_json JSONB,
      notes TEXT,
      created_by VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dashboard_items (
      id VARCHAR(64) PRIMARY KEY,
      dashboard_artifact_id VARCHAR(64) NOT NULL,
      child_artifact_id VARCHAR(64) NOT NULL,
      child_artifact_version_id VARCHAR(64),
      position_json JSONB,
      display_json JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS artifact_runs (
      id VARCHAR(64) PRIMARY KEY,
      artifact_id VARCHAR(64) NOT NULL,
      artifact_version_id VARCHAR(64),
      query_spec_id VARCHAR(64),
      organization_id VARCHAR(64) NOT NULL,
      project_id VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'running',
      trigger_type VARCHAR(32) NOT NULL DEFAULT 'manual',
      run_input_json JSONB,
      result_meta_json JSONB,
      result_sample_json JSONB,
      sql_text_snapshot TEXT,
      error_text TEXT,
      started_at TIMESTAMP DEFAULT NOW() NOT NULL,
      completed_at TIMESTAMP
    )
  `);

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_project_agents_org ON project_agents(organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_pa_source_meta_project ON project_agent_source_meta(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_pa_runs_project ON project_data_query_runs(project_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_pa_rules_project ON project_data_memory_rules(project_id, priority, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_pa_workflows_project ON project_data_workflows(project_id, updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_pa_workflow_runs_project ON project_data_workflow_runs(project_id, started_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_query_specs_org_project ON query_specs(organization_id, project_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_artifacts_org_project_type ON artifacts(organization_id, project_id, type, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact_version ON artifact_versions(artifact_id, version DESC)',
    'CREATE INDEX IF NOT EXISTS idx_dashboard_items_dashboard ON dashboard_items(dashboard_artifact_id, created_at ASC)',
    'CREATE INDEX IF NOT EXISTS idx_artifact_runs_artifact_started ON artifact_runs(artifact_id, started_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_artifact_runs_org_project ON artifact_runs(organization_id, project_id, started_at DESC)',
  ];
  for (const stmt of indexes) {
    await db.execute(sql.raw(stmt)).catch(() => {});
  }
}
