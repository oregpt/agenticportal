/**
 * Initialize database: enable pgvector and create tables
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function initDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    
    // Enable pgvector extension
    console.log('Enabling pgvector extension...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✓ pgvector enabled');

    // Verify
    const result = await pool.query("SELECT extname FROM pg_extension WHERE extname = 'vector';");
    if (result.rows.length > 0) {
      console.log('✓ Verified: pgvector extension is active');
    }

    console.log('\nDatabase initialized successfully!');
    console.log('Now run: npx drizzle-kit push');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
