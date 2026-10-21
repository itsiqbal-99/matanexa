const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  normalizeQuery,
  searchSchema,
} = require('../dist/modules/search/search.schema');
const { MockRepository } = require('../dist/modules/search/mock.repository');
const { createApp } = require('../dist/create-app');

test('query normalization is Unicode aware, bounded and idempotent', () => {
  const normalized = normalizeQuery('  ＩＬＭＵ\n\t BELAJAR\u200B ');
  assert.equal(normalized, 'ilmu belajar');
  assert.equal(normalizeQuery(normalized), normalized);
  assert.equal(
    searchSchema.safeParse({ query: 'ا'.repeat(300) }).success,
    true,
  );
  assert.equal(
    searchSchema.safeParse({ query: 'ا'.repeat(301) }).success,
    false,
  );
  assert.equal(searchSchema.safeParse({ query: '   \n   ' }).success, false);
});

test('six topics and synonyms match deterministically; mock has no religious source content', () => {
  const repository = new MockRepository();
  const examples = [
    ['Kasih hadits tentang menuntut ilmu', 'knowledge'],
    ['Minta dong hadits tentang berbakti kepada orang tua', 'parents'],
    ['Ada hadits tentang jangan gampang marah?', 'anger'],
    ['Hadits tentang makan pakai tangan kanan', 'eating'],
    ['Apa ada hadits soal menjaga lisan?', 'speech'],
    ['keutamaan donasi', 'charity'],
  ];
  for (const [query, topic] of examples) {
    const results = repository.find(query);
    assert.equal(results.length, 2);
    assert.match(results[0].id, new RegExp(`^mock-${topic}-`));
    assert.deepEqual(repository.find(query), results);
    for (const result of results) {
      for (const field of [
        'hadithNumber',
        'arabicText',
        'translation',
        'grade',
        'sourceUrl',
        'referenceUrl',
      ])
        assert.equal(result[field], null);
      assert.equal(result.isVerified, false);
      assert.match(result.excerpt, /Data simulasi/);
    }
  }
  assert.equal(repository.find('ilmu', ['mock-a']).length, 1);
  assert.deepEqual(repository.find('ilmu', ['bukhari']), []);
  assert.deepEqual(repository.find('mobil listrik'), []);
  assert.deepEqual(repository.find("' OR 1=1; DROP TABLE hadiths; --"), []);
  assert.deepEqual(repository.find('ibukota'), []);
});

test('real HTTP search validates bodies, pagination, CORS and safe errors', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const post = (body) =>
    fetch(`${base}/api/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify(body),
    });
  const success = await post({ query: 'menuntut ilmu', limit: 1 });
  assert.equal(success.status, 200);
  assert.equal(
    success.headers.get('access-control-allow-origin'),
    'http://localhost:3000',
  );
  const body = await success.json();
  assert.equal(success.headers.get('x-request-id'), body.meta.requestId);
  assert.equal(body.meta.modeUsed, 'mock');
  assert.equal(body.meta.hasMore, true);
  assert.equal(body.data.totalCandidates, 2);
  const page2 = await (await post({ query: 'ilmu', limit: 1, page: 2 })).json();
  assert.notEqual(page2.data.results[0].id, body.data.results[0].id);
  const filtered = await (
    await post({ query: 'ilmu', filters: { sourceSlugs: ['mock-b'] } })
  ).json();
  assert.equal(filtered.data.results.length, 1);
  for (const invalid of [
    {},
    null,
    [],
    { query: '' },
    { query: 123 },
    { query: 'x'.repeat(301) },
    { query: 'ilmu', limit: 21 },
    { query: 'ilmu', page: 0 },
    { query: 'ilmu', page: 11 },
    { query: 'ilmu', extra: true },
    { query: 'ilmu', filters: { bad: true } },
    { query: 'ilmu', filters: { sourceSlugs: ['a', 'a'] } },
  ]) {
    const response = await post(invalid);
    assert.equal(response.status, 400);
    const error = await response.json();
    assert.equal(error.error.code, 'VALIDATION_ERROR');
    assert.match(error.error.requestId, /^[\da-f-]{36}$/);
    assert.equal(response.headers.get('x-request-id'), error.error.requestId);
    assert.equal(error.error.stack, undefined);
  }
  const malformed = await fetch(`${base}/api/v1/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad',
  });
  assert.equal(malformed.status, 400);
  const preflight = await fetch(`${base}/api/v1/search`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
});
