const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createApp } = require('../dist/create-app');
const { readEnvironment } = require('../dist/config/environment');

test('environment defaults and invalid configuration fail closed', () => {
  assert.equal(readEnvironment({}).mode, 'mock');
  assert.equal(readEnvironment({}).port, 4000);
  assert.equal(readEnvironment({}).retrievalTimeoutMs, 10000);
  assert.equal(readEnvironment({}).retrievalMaxOutputBytes, 262144);
  assert.equal(readEnvironment({}).orchestrationMaxContextChars, 16000);
  assert.equal(readEnvironment({}).orchestrationMaxOutputBytes, 65536);
  assert.equal(readEnvironment({}).orchestrationMaxToolExecutions, 4);
  assert.equal(readEnvironment({}).orchestrationMaxOutputTokens, 512);
  assert.equal(readEnvironment({}).internalConversationApiEnabled, false);
  assert.equal(readEnvironment({}).conversationApiTimeoutMs, 45000);
  assert.equal(readEnvironment({}).conversationApiMaxConcurrency, 2);
  assert.equal(readEnvironment({}).conversationSseMaxOutputBytes, 262144);
  assert.equal(
    readEnvironment({
      NODE_ENV: 'test',
      INTERNAL_CONVERSATION_API_ENABLED: 'true',
      INTERNAL_CONVERSATION_API_KEY: 'test-internal-key-0123456789-abcdef',
    }).internalConversationApiEnabled,
    true,
  );
  for (const env of [
    { PORT: '0' },
    { PORT: '4000oops' },
    { PORT: '65536' },
    { APP_SEARCH_MODE: 'hybrid' },
    { APP_SEARCH_MODE: 'lexical' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://example.com' },
    { CORS_ORIGINS: 'http://localhost:3000/' },
    { CORS_ORIGINS: '' },
    { CORS_ORIGINS: 'http://localhost:99999' },
    { RETRIEVAL_TIMEOUT_MS: '99' },
    { RETRIEVAL_TIMEOUT_MS: '30001' },
    { RETRIEVAL_MAX_OUTPUT_BYTES: '16383' },
    { RETRIEVAL_MAX_OUTPUT_BYTES: '1048577' },
    { ORCHESTRATION_MAX_CONTEXT_CHARS: '1999' },
    { ORCHESTRATION_MAX_OUTPUT_BYTES: '262145' },
    { ORCHESTRATION_MAX_TOOL_EXECUTIONS: '7' },
    { ORCHESTRATION_MAX_OUTPUT_TOKENS: '63' },
    { INTERNAL_CONVERSATION_API_ENABLED: '1' },
    {
      NODE_ENV: 'production',
      INTERNAL_CONVERSATION_API_ENABLED: 'true',
      INTERNAL_CONVERSATION_API_KEY: 'test-internal-key-0123456789-abcdef',
    },
    {
      NODE_ENV: 'test',
      INTERNAL_CONVERSATION_API_ENABLED: 'true',
      INTERNAL_CONVERSATION_API_KEY: 'too-short',
    },
    { CONVERSATION_API_TIMEOUT_MS: '999' },
    { CONVERSATION_API_MAX_CONCURRENCY: '9' },
    { CONVERSATION_SSE_MAX_OUTPUT_BYTES: '4095' },
  ])
    assert.throws(() => readEnvironment(env));
});

test('HTTP health contract, restricted CORS and safe 404', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const response = await fetch(`${base}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('x-request-id'), /^[\da-f-]{36}$/);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    mode: 'mock',
    databaseConfigured: false,
  });
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
    const allowed = await fetch(`${base}/api/v1/health`, {
      headers: { Origin: origin },
    });
    assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
    const preflight = await fetch(`${base}/api/v1/health`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  }
  for (const origin of [
    'https://example.com',
    'http://localhost:3001',
    'http://localhost:3000.evil.test',
  ]) {
    const denied = await fetch(`${base}/api/v1/health`, {
      headers: { Origin: origin },
    });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
  const missing = await fetch(`${base}/api/v1/search`);
  assert.equal(missing.status, 404);
  const body = await missing.json();
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.match(body.error.requestId, /^[\da-f-]{36}$/);
  assert.equal(missing.headers.get('x-request-id'), body.error.requestId);
  assert.equal(body.error.stack, undefined);
  const sources = await fetch(`${base}/api/v1/sources`);
  assert.equal(sources.status, 200);
  const sourcesBody = await sources.json();
  assert.deepEqual(sourcesBody.data, []);
  assert.equal(sources.headers.get('x-request-id'), sourcesBody.meta.requestId);
  assert.equal(
    (await fetch(`${base}/api/v1/hadiths/11111111-1111-4111-8111-111111111111`))
      .status,
    404,
  );
});
