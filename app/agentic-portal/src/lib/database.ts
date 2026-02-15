import type { PoolConfig } from 'pg';

const DATABASE_URL_ENV_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL',
  'PGDATABASE_URL',
] as const;

type PgSslConfig = PoolConfig['ssl'];

function resolveDatabaseUrlFromEnv(): string {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function resolveSslConfig(databaseUrl: string): PgSslConfig {
  const forceSsl = process.env.PG_FORCE_SSL === 'true';
  const disableSsl = process.env.PG_DISABLE_SSL === 'true';
  if (disableSsl) return false;
  if (forceSsl) return { rejectUnauthorized: false };

  try {
    const url = new URL(databaseUrl);
    const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase();
    if (sslMode === 'disable') return false;
    if (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'verify-ca' || sslMode === 'verify-full') {
      return { rejectUnauthorized: false };
    }
  } catch {
    // Keep default below when the URL is not parseable.
  }

  // Default to no SSL unless explicitly requested.
  // Some managed DB TCP proxies (including certain Railway setups) reject SSL with:
  // "The server does not support SSL connections".
  return false;
}

export function getDatabasePoolConfig(): PoolConfig {
  const connectionString = resolveDatabaseUrlFromEnv();
  return {
    connectionString,
    ssl: resolveSslConfig(connectionString),
  };
}

export function getDatabaseConfigError(): string | null {
  const connectionString = resolveDatabaseUrlFromEnv();
  if (!connectionString) {
    return `Missing database connection string. Set one of: ${DATABASE_URL_ENV_KEYS.join(', ')}`;
  }
  return null;
}
