/**
 * Database Initialization — PostgreSQL + pgvector
 *
 * Creates all essential tables and indexes for AgentLite.
 * Stripped from agentinabox_v2: SQLite mode, KB folders/tags,
 * GitLab, proactive engine, multi-channel tables.
 */

import { db } from './client';
import { sql } from 'drizzle-orm';

async function createTablesIfNotExist(): Promise<void> {
  // Agents table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agents (
      id VARCHAR(64) PRIMARY KEY,
      slug VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      instructions TEXT,
      default_model VARCHAR(128) NOT NULL,
      branding JSONB,
      features JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Conversations table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id SERIAL PRIMARY KEY,
      public_id VARCHAR(64) NOT NULL UNIQUE,
      session_token VARCHAR(128) NOT NULL,
      agent_id VARCHAR(64) NOT NULL,
      external_user_id VARCHAR(255),
      title VARCHAR(255),
      session_summary TEXT,
      message_count INT DEFAULT 0,
      last_message_at TIMESTAMPTZ,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Messages table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      role VARCHAR(16) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Capabilities table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_capabilities (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(32) NOT NULL,
      category VARCHAR(64),
      config JSONB,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Agent capabilities table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agent_capabilities (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      capability_id VARCHAR(64) NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Capability tokens table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_capability_tokens (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      capability_id VARCHAR(64) NOT NULL,
      token1 TEXT,
      token2 TEXT,
      token3 TEXT,
      token4 TEXT,
      token5 TEXT,
      iv VARCHAR(32),
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Knowledge Base: Documents table (RAG)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_documents (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      source_type VARCHAR(32) NOT NULL,
      mime_type VARCHAR(128),
      size INTEGER,
      storage_path VARCHAR(512),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Knowledge Base: Document chunks table (RAG embeddings)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES ai_documents(id) ON DELETE CASCADE,
        agent_id VARCHAR(64) NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        token_count INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
  } catch {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES ai_documents(id) ON DELETE CASCADE,
        agent_id VARCHAR(64) NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT,
        token_count INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.warn('[db] Created ai_document_chunks without vector type (pgvector not available)');
  }

  // Agent documents table (soul.md, memory.md, context.md)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agent_documents (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      doc_type VARCHAR(50) NOT NULL,
      doc_key VARCHAR(255) NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Agent memory embeddings table (chunked vectors for semantic search)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_agent_memory_embeddings (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        doc_id INTEGER NOT NULL REFERENCES ai_agent_documents(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        embedding vector(1536),
        line_start INTEGER,
        line_end INTEGER,
        content_hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
  } catch {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_agent_memory_embeddings (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        doc_id INTEGER NOT NULL REFERENCES ai_agent_documents(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        embedding TEXT,
        line_start INTEGER,
        line_end INTEGER,
        content_hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.warn('[db] Created ai_agent_memory_embeddings without vector type (pgvector not available)');
  }

  // Per-agent API keys table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agent_api_keys (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      key VARCHAR(64) NOT NULL,
      encrypted_value TEXT NOT NULL,
      iv VARCHAR(32),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(agent_id, key)
    )
  `);

  // ============================================================================
  // Performance Indexes
  // ============================================================================

  const indexes = [
    // Chat performance
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON ai_messages(conversation_id)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON ai_conversations(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON ai_conversations(agent_id, last_message_at DESC)',
    // Capabilities
    'CREATE INDEX IF NOT EXISTS idx_agent_capabilities_agent ON ai_agent_capabilities(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_capability_tokens_agent ON ai_capability_tokens(agent_id, capability_id)',
    // Agent API keys
    'CREATE INDEX IF NOT EXISTS idx_agent_api_keys_agent ON ai_agent_api_keys(agent_id)',
    // Knowledge Base (RAG)
    'CREATE INDEX IF NOT EXISTS idx_documents_agent_id ON ai_documents(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_document_chunks_agent ON ai_document_chunks(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON ai_document_chunks(document_id)',
    // Soul & Memory
    'CREATE INDEX IF NOT EXISTS idx_agent_documents_agent_type ON ai_agent_documents(agent_id, doc_type)',
    'CREATE INDEX IF NOT EXISTS idx_agent_memory_embeddings_agent ON ai_agent_memory_embeddings(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_agent_memory_embeddings_doc ON ai_agent_memory_embeddings(doc_id)',
    'CREATE INDEX IF NOT EXISTS idx_agent_memory_embeddings_hash ON ai_agent_memory_embeddings(doc_id, content_hash)',
  ];

  for (const idx of indexes) {
    await db.execute(sql.raw(idx)).catch(() => {});
  }

  // Unique index for agent documents
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_documents_agent_key
    ON ai_agent_documents(agent_id, doc_key)
  `).catch(() => {});

  // ============================================================================
  // Migrations for existing databases (safe to re-run)
  // ============================================================================

  // Add admin_key to agents table
  await db.execute(sql`
    ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS admin_key VARCHAR(128)
  `).catch(() => {});

  // Add public_id and session_token to conversations table
  await db.execute(sql`
    ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS public_id VARCHAR(64)
  `).catch(() => {});
  await db.execute(sql`
    ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS session_token VARCHAR(128)
  `).catch(() => {});

  // Backfill existing conversations with UUIDs and tokens
  await db.execute(sql`
    UPDATE ai_conversations
    SET public_id = gen_random_uuid()::text,
        session_token = encode(gen_random_bytes(32), 'hex')
    WHERE public_id IS NULL OR session_token IS NULL
  `).catch(() => {});

  // Now make them NOT NULL (safe after backfill)
  await db.execute(sql`
    ALTER TABLE ai_conversations ALTER COLUMN public_id SET NOT NULL
  `).catch(() => {});
  await db.execute(sql`
    ALTER TABLE ai_conversations ALTER COLUMN session_token SET NOT NULL
  `).catch(() => {});

  // Add unique index on public_id
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_public_id ON ai_conversations(public_id)
  `).catch(() => {});

  // Vector similarity index (HNSW)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_agent_memory_embeddings_vector
    ON ai_agent_memory_embeddings
    USING hnsw (embedding vector_cosine_ops)
  `).catch(() => {
    console.log('[db] HNSW vector index creation skipped (pgvector not ready or empty table)');
  });

  // Vector similarity index for document chunks (HNSW)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_document_chunks_vector
    ON ai_document_chunks
    USING hnsw (embedding vector_cosine_ops)
  `).catch(() => {
    console.log('[db] HNSW vector index for document_chunks skipped (pgvector not ready or empty table)');
  });

  console.log('[db] All 11 tables and indexes created/verified');
}

/**
 * Initialize database with required extensions and schema
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Enable pgvector extension
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      console.log('[db] pgvector extension enabled');
    } catch (extError) {
      console.warn('[db] pgvector extension not available — vector features will be disabled.', (extError as Error).message);
    }

    // Create all tables
    await createTablesIfNotExist();

    console.log('[db] Database initialization complete');
  } catch (error) {
    console.error('[db] Database initialization error:', error);
    throw error;
  }
}
