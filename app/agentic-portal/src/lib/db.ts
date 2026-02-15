/**
 * Database client for Next.js API routes
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/server/db/schema';
import { getDatabasePoolConfig } from '@/lib/database';

const pool = new Pool(getDatabasePoolConfig());

export const db = drizzle(pool, { schema });
export { schema };
