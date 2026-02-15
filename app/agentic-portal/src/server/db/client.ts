/**
 * Database Client — PostgreSQL only (AgentLite)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { loadConfig } from '../config/appConfig';
import { getDatabasePoolConfig } from '@/lib/database';

const config = loadConfig();
const poolConfig = getDatabasePoolConfig();
const pool = new Pool({
  ...poolConfig,
  connectionString: config.databaseUrl || poolConfig.connectionString,
});

export const db = drizzle(pool);
