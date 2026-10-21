export interface Environment {
  runtimeEnvironment: 'development' | 'test' | 'production';
  port: number;
  mode: 'mock' | 'lexical' | 'hybrid';
  dataScope: 'published' | 'local_pilot';
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  databaseUrl?: string;
  poolMax: number;
  databaseTimeout: number;
  corsOrigins: string[];
  llmProvider: 'disabled' | 'cloudflare';
  llmModel?: string;
  llmTimeoutMs: number;
  llmMaxConcurrency: number;
  retrievalTimeoutMs: number;
  retrievalMaxOutputBytes: number;
  orchestrationMaxContextChars: number;
  orchestrationMaxOutputBytes: number;
  orchestrationMaxToolExecutions: number;
  orchestrationMaxOutputTokens: number;
  internalConversationApiEnabled: boolean;
  internalConversationApiKey?: string;
  conversationApiTimeoutMs: number;
  conversationApiMaxConcurrency: number;
  conversationSseMaxOutputBytes: number;
}

export const ENVIRONMENT = Symbol('ENVIRONMENT');

export function readEnvironment(env: NodeJS.ProcessEnv): Environment {
  const runtimeEnvironment = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(runtimeEnvironment))
    throw new Error('NODE_ENV harus development|test|production.');
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
  const llmProvider = env.AI_LLM_PROVIDER ?? 'disabled';
  if (!['disabled', 'cloudflare'].includes(llmProvider))
    throw new Error('Gunakan AI_LLM_PROVIDER=disabled|cloudflare.');
  const llmTimeoutMs = Number(env.AI_LLM_TIMEOUT_MS ?? 30000);
  const llmMaxConcurrency = Number(env.AI_LLM_MAX_CONCURRENCY ?? 2);
  if (
    !Number.isInteger(llmTimeoutMs) ||
    llmTimeoutMs < 100 ||
    llmTimeoutMs > 120000 ||
    !Number.isInteger(llmMaxConcurrency) ||
    llmMaxConcurrency < 1 ||
    llmMaxConcurrency > 4
  )
    throw new Error(
      'AI_LLM_TIMEOUT_MS harus 100–120000; AI_LLM_MAX_CONCURRENCY harus 1–4.',
    );
  const retrievalTimeoutMs = Number(env.RETRIEVAL_TIMEOUT_MS ?? 10000);
  const retrievalMaxOutputBytes = Number(
    env.RETRIEVAL_MAX_OUTPUT_BYTES ?? 262144,
  );
  if (
    !Number.isInteger(retrievalTimeoutMs) ||
    retrievalTimeoutMs < 100 ||
    retrievalTimeoutMs > 30000 ||
    !Number.isInteger(retrievalMaxOutputBytes) ||
    retrievalMaxOutputBytes < 16384 ||
    retrievalMaxOutputBytes > 1048576
  )
    throw new Error(
      'RETRIEVAL_TIMEOUT_MS harus 100–30000; RETRIEVAL_MAX_OUTPUT_BYTES harus 16384–1048576.',
    );
  const orchestrationMaxContextChars = Number(
    env.ORCHESTRATION_MAX_CONTEXT_CHARS ?? 16000,
  );
  const orchestrationMaxOutputBytes = Number(
    env.ORCHESTRATION_MAX_OUTPUT_BYTES ?? 65536,
  );
  const orchestrationMaxToolExecutions = Number(
    env.ORCHESTRATION_MAX_TOOL_EXECUTIONS ?? 4,
  );
  const orchestrationMaxOutputTokens = Number(
    env.ORCHESTRATION_MAX_OUTPUT_TOKENS ?? 512,
  );
  if (
    !Number.isInteger(orchestrationMaxContextChars) ||
    orchestrationMaxContextChars < 2000 ||
    orchestrationMaxContextChars > 60000 ||
    !Number.isInteger(orchestrationMaxOutputBytes) ||
    orchestrationMaxOutputBytes < 4096 ||
    orchestrationMaxOutputBytes > 262144 ||
    !Number.isInteger(orchestrationMaxToolExecutions) ||
    orchestrationMaxToolExecutions < 2 ||
    orchestrationMaxToolExecutions > 6 ||
    !Number.isInteger(orchestrationMaxOutputTokens) ||
    orchestrationMaxOutputTokens < 64 ||
    orchestrationMaxOutputTokens > 2048
  )
    throw new Error(
      'Batas orchestration tidak valid: context 2000–60000, output 4096–262144 byte, tools 2–6, tokens 64–2048.',
    );
  const internalApiRaw = env.INTERNAL_CONVERSATION_API_ENABLED ?? 'false';
  if (!['true', 'false'].includes(internalApiRaw))
    throw new Error('INTERNAL_CONVERSATION_API_ENABLED harus true atau false.');
  const internalConversationApiEnabled = internalApiRaw === 'true';
  const conversationApiTimeoutMs = Number(
    env.CONVERSATION_API_TIMEOUT_MS ?? 45000,
  );
  const conversationApiMaxConcurrency = Number(
    env.CONVERSATION_API_MAX_CONCURRENCY ?? 2,
  );
  const conversationSseMaxOutputBytes = Number(
    env.CONVERSATION_SSE_MAX_OUTPUT_BYTES ?? 262144,
  );
  if (
    !Number.isInteger(conversationApiTimeoutMs) ||
    conversationApiTimeoutMs < 1000 ||
    conversationApiTimeoutMs > 120000 ||
    !Number.isInteger(conversationApiMaxConcurrency) ||
    conversationApiMaxConcurrency < 1 ||
    conversationApiMaxConcurrency > 8 ||
    !Number.isInteger(conversationSseMaxOutputBytes) ||
    conversationSseMaxOutputBytes < 4096 ||
    conversationSseMaxOutputBytes > 1048576
  )
    throw new Error(
      'Batas conversation API tidak valid: timeout 1000–120000, concurrency 1–8, SSE 4096–1048576 byte.',
    );
  if (
    internalConversationApiEnabled &&
    (!['development', 'test'].includes(runtimeEnvironment) ||
      !env.INTERNAL_CONVERSATION_API_KEY ||
      !/^[\x21-\x7e]{32,256}$/.test(env.INTERNAL_CONVERSATION_API_KEY))
  )
    throw new Error(
      'API percakapan internal hanya boleh aktif di development/test dengan access key ASCII 32–256 karakter.',
    );
  if (
    llmProvider === 'cloudflare' &&
    (!env.CLOUDFLARE_ACCOUNT_ID ||
      !env.CLOUDFLARE_API_TOKEN ||
      !env.AI_LLM_MODEL ||
      !/^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(env.AI_LLM_MODEL) ||
      env.AI_LLM_MODEL.includes('..'))
  )
    throw new Error(
      'Cloudflare LLM memerlukan account, token, dan AI_LLM_MODEL @cf/... yang valid.',
    );
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
    runtimeEnvironment: runtimeEnvironment as Environment['runtimeEnvironment'],
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
    llmProvider: llmProvider as Environment['llmProvider'],
    ...(env.AI_LLM_MODEL ? { llmModel: env.AI_LLM_MODEL } : {}),
    llmTimeoutMs,
    llmMaxConcurrency,
    retrievalTimeoutMs,
    retrievalMaxOutputBytes,
    orchestrationMaxContextChars,
    orchestrationMaxOutputBytes,
    orchestrationMaxToolExecutions,
    orchestrationMaxOutputTokens,
    internalConversationApiEnabled,
    ...(env.INTERNAL_CONVERSATION_API_KEY
      ? { internalConversationApiKey: env.INTERNAL_CONVERSATION_API_KEY }
      : {}),
    conversationApiTimeoutMs,
    conversationApiMaxConcurrency,
    conversationSseMaxOutputBytes,
    ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
  };
}
