export interface Environment {
  port: number;
  mode: 'mock' | 'lexical' | 'hybrid';
  dataScope: 'published' | 'local_pilot';
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  databaseUrl?: string;
  poolMax: number;
  databaseTimeout: number;
  corsOrigins: string[];
}

export const ENVIRONMENT = Symbol('ENVIRONMENT');

export function readEnvironment(env: NodeJS.ProcessEnv): Environment {
  const rawPort = env.PORT ?? '4000';
  if (
    !/^\d+$/.test(rawPort) ||
    Number(rawPort) < 1 ||
    Number(rawPort) > 65535
  ) {
    throw new Error('PORT harus berupa integer 1–65535.');
  }
  const mode = env.APP_SEARCH_MODE ?? 'mock';
  if (!['mock', 'lexical', 'hybrid'].includes(mode))
    throw new Error('Gunakan APP_SEARCH_MODE=mock|lexical|hybrid.');
  const dataScope = env.APP_DATA_SCOPE ?? 'published';
  if (
    !['published', 'local_pilot'].includes(dataScope) ||
    (dataScope === 'local_pilot' && env.NODE_ENV !== 'development')
  )
    throw new Error(
      'APP_DATA_SCOPE=local_pilot hanya di NODE_ENV=development.',
    );
  const poolMax = Number(env.DB_POOL_MAX ?? 3);
  const databaseTimeout = Number(env.DB_TIMEOUT_MS ?? 5000);
  if (
    !Number.isInteger(poolMax) ||
    poolMax < 1 ||
    poolMax > 3 ||
    !Number.isInteger(databaseTimeout) ||
    databaseTimeout < 100 ||
    databaseTimeout > 10000
  )
    throw new Error('DB_POOL_MAX harus 1–3; DB_TIMEOUT_MS harus 100–10000.');
  if (mode !== 'mock' && !env.DATABASE_URL)
    throw new Error('DATABASE_URL wajib untuk mode lexical/hybrid.');
  const corsOrigins = (
    env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((origin) => origin.trim());
  if (
    !corsOrigins.length ||
    corsOrigins.some(
      (origin) =>
        !/^http:\/\/(localhost|127\.0\.0\.1):([1-9]\d{0,4})$/.test(origin) ||
        Number(new URL(origin).port) > 65535,
    )
  ) {
    throw new Error(
      'CORS_ORIGINS hanya boleh berisi origin HTTP localhost dengan port eksplisit.',
    );
  }
  return {
    port: Number(rawPort),
    mode: mode as Environment['mode'],
    dataScope: dataScope as Environment['dataScope'],
    ...(env.CLOUDFLARE_ACCOUNT_ID
      ? { cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID }
      : {}),
    ...(env.CLOUDFLARE_API_TOKEN
      ? { cloudflareApiToken: env.CLOUDFLARE_API_TOKEN }
      : {}),
    corsOrigins,
    poolMax,
    databaseTimeout,
    ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
  };
}
