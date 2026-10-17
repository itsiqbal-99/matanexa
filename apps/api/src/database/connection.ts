import { Pool, type PoolConfig } from 'pg';

export function poolOptions(url: string, max = 3, timeout = 5000): PoolConfig {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL tidak valid.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !parsed.hostname.endsWith('.neon.tech') ||
    !parsed.username ||
    !parsed.password ||
    !parsed.pathname.slice(1) ||
    parsed.hash ||
    [...parsed.searchParams.keys()].some(
      (key) => !['sslmode', 'channel_binding'].includes(key),
    ) ||
    (parsed.searchParams.has('sslmode') &&
      !['require', 'verify-full'].includes(parsed.searchParams.get('sslmode')!))
  ) {
    throw new Error(
      'DATABASE_URL harus koneksi Neon PostgreSQL dengan TLS terverifikasi.',
    );
  }
  // pg URL SSL parameters can override the explicit TLS object; strip them.
  parsed.search = '';
  return {
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: true },
    enableChannelBinding: true,
    max,
    // Neon cold connection/TLS can exceed the SQL execution budget.
    connectionTimeoutMillis: Math.max(timeout, 10000),
    idleTimeoutMillis: 10000,
    statement_timeout: timeout,
    query_timeout: timeout + 1000,
    application_name: 'matanexa-local',
  };
}
export function createPool(url: string, max?: number, timeout?: number): Pool {
  const pool = new Pool(poolOptions(url, max, timeout));
  // Do not log errors containing connection credentials from background clients.
  pool.on('error', () => undefined);
  return pool;
}

// Session state (TEMP tables/search_path) requires a direct Neon connection.
// PgBouncer transaction pooling can assign a different backend after each query.
export function sessionPoolOptions(url: string, timeout = 10000): PoolConfig {
  const options = poolOptions(url, 1, timeout);
  const parsed = new URL(options.connectionString!);
  parsed.hostname = parsed.hostname.replace(/-pooler(?=\.)/, '');
  return { ...options, connectionString: parsed.toString() };
}
export function createSessionPool(url: string, timeout?: number): Pool {
  const pool = new Pool(sessionPoolOptions(url, timeout));
  pool.on('error', () => undefined);
  return pool;
}
