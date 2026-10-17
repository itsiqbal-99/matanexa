import assert from 'node:assert/strict';

const webUrl = 'http://localhost:3000';
const apiUrl = 'http://localhost:4000/api/v1/health';
const web = await fetch(webUrl, { signal: AbortSignal.timeout(60000) });
assert.equal(web.status, 200);
const html = await web.text();
assert.match(html, /Matanexa/);
assert.match(html, /Cari hadits dengan/);
assert.match(html, /lang="id"/);
assert.match(html, /Konten contoh/);
const stylesheet = html.match(/href="([^\"]+\.css(?:\?[^\"]*)?)"/);
assert.ok(stylesheet, 'Next.js includes compiled CSS');
const css = await fetch(
  new URL(stylesheet[1].replaceAll('&amp;', '&'), webUrl),
);
assert.equal(css.status, 200);
const cssText = await css.text();
assert.ok(
  cssText.includes('@layer base') &&
    cssText.includes('--default-font-family') &&
    cssText.includes('.composer'),
  'Tailwind preflight and application styles are compiled',
);
console.log(
  'PASS web: HTTP 200, Indonesian chat page, mock disclosure, compiled Tailwind CSS',
);

for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
  const response = await fetch(apiUrl, {
    headers: { Origin: origin },
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    mode: 'mock',
    databaseConfigured: false,
  });
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
}
console.log('PASS API: HTTP 200, health JSON, both localhost CORS origins');
const denied = await fetch(apiUrl, {
  headers: { Origin: 'https://example.com' },
});
assert.equal(denied.headers.get('access-control-allow-origin'), null);
console.log('PASS CORS: external origin has no access-control-allow-origin');
const search = await fetch('http://localhost:4000/api/v1/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: webUrl },
  body: JSON.stringify({ query: 'berbakti kepada orang tua', limit: 10 }),
});
assert.equal(search.status, 200);
const payload = await search.json();
assert.equal(payload.meta.modeUsed, 'mock');
assert.equal(payload.data.results.length, 2);
for (const item of payload.data.results) {
  assert.equal(item.isVerified, false);
  for (const field of [
    'arabicText',
    'translation',
    'hadithNumber',
    'grade',
    'sourceUrl',
  ])
    assert.equal(item[field], null);
}
console.log(
  'PASS search: independent query, matching mock topic, no religious source content',
);
