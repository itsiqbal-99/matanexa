const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createApp } = require('../dist/create-app');
const { readEnvironment } = require('../dist/config/environment');

test('environment defaults and invalid configuration fail closed', () => {
  assert.equal(readEnvironment({}).mode, 'mock');
  assert.equal(readEnvironment({}).port, 4000);
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
  assert.equal(body.error.stack, undefined);
  const sources = await fetch(`${base}/api/v1/sources`);
  assert.equal(sources.status, 200);
  assert.deepEqual((await sources.json()).data, []);
  assert.equal(
    (await fetch(`${base}/api/v1/hadiths/11111111-1111-4111-8111-111111111111`))
      .status,
    404,
  );
});
