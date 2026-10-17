const assert = require('node:assert/strict');
const { test } = require('node:test');
require('dotenv').config({ quiet: true });
const { createApp } = require('../dist/create-app');
test(
  'REAL NEON HTTP: lexical mode, original query, ambiguity, public corpus and sources',
  { skip: !process.env.DATABASE_URL ? 'DATABASE_URL missing' : false },
  async (t) => {
    const previous = process.env.APP_SEARCH_MODE;
    const previousScope = process.env.APP_DATA_SCOPE;
    process.env.APP_DATA_SCOPE = 'published';
    process.env.APP_SEARCH_MODE = 'lexical';
    const app = await createApp(false);
    if (previousScope === undefined) delete process.env.APP_DATA_SCOPE;
    else process.env.APP_DATA_SCOPE = previousScope;
    if (previous === undefined) delete process.env.APP_SEARCH_MODE;
    else process.env.APP_SEARCH_MODE = previous;
    t.after(() => app.close());
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.mode, 'lexical');
    assert.equal(health.databaseConfigured, true);
    for (const [query, status] of [
      ['Kasih DONG hadist soal ILMU!', 'ready'],
      ['Hadits tentang ini dong', 'ambiguous'],
    ]) {
      const response = await fetch(`${base}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.data.query, query);
      assert.equal(body.meta.modeUsed, 'lexical');
      assert.equal(body.meta.queryStatus, status);
      // This is read-only against the development corpus, which may legitimately be empty.
      assert.ok(Array.isArray(body.data.results));
      assert.ok(
        body.data.results.every(
          (row) => row.isVerified === true && !row.id.startsWith('mock-'),
        ),
      );
      assert.equal(JSON.stringify(body).includes('primary_signal'), false);
      if (status === 'ambiguous') assert.equal(body.data.results.length, 0);
    }
    const sources = await fetch(`${base}/sources`);
    assert.equal(sources.status, 200);
    assert.ok(Array.isArray((await sources.json()).data));
  },
);
