const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const http = require('node:http');
require('dotenv').config({ quiet: true });
const { createApp } = require('../dist/create-app');
const { createPool } = require('../dist/database/connection');
const { importDataset } = require('../dist/database/importer');
const { preparePilot } = require('../dist/database/pilot');

const rawPilotDir = resolve(__dirname, '../../../data/local-pilot/fawaz/raw');
const arabicSourcePath = resolve(rawPilotDir, 'ara-bukhari.json');
const indonesianSourcePath = resolve(rawPilotDir, 'ind-bukhari.json');
const preparedPilotPath = resolve(
  __dirname,
  '../../../data/local-pilot/fawaz/pilot.json',
);

test(
  'REAL SOURCE: array order is irrelevant; mismatched, empty and duplicated identities are rejected',
  {
    skip:
      !existsSync(arabicSourcePath) || !existsSync(indonesianSourcePath)
        ? 'Local pilot source fixtures missing'
        : false,
  },
  async () => {
    const arabic = JSON.parse(await readFile(arabicSourcePath, 'utf8'));
    const indonesian = JSON.parse(await readFile(indonesianSourcePath, 'utf8'));
    const baseline = preparePilot(
      JSON.stringify(arabic),
      JSON.stringify(indonesian),
    );
    indonesian.hadiths.reverse();
    const reversed = preparePilot(
      JSON.stringify(arabic),
      JSON.stringify(indonesian),
    );
    // Selection includes a bounded knowledge/zakat sample, so compare the anchor
    // identity/pair rather than assuming the whole sample ignores selection order.
    for (const n of ['5376', '5971', '6116']) {
      const a = baseline.dataset.records.find((r) => r.hadithNumber === n);
      const b = reversed.dataset.records.find((r) => r.hadithNumber === n);
      assert.equal(b.arabicText, a.arabicText);
      assert.equal(b.indonesianText, a.indonesianText);
    }
    arabic.hadiths.find(
      (r) => String(r.hadithnumber) === '5377',
    ).reference.book = 999;
    indonesian.hadiths.find((r) => String(r.hadithnumber) === '5398').text = '';
    arabic.hadiths.push(
      arabic.hadiths.find((r) => String(r.hadithnumber) === '5399'),
    );
    const rejected = preparePilot(
      JSON.stringify(arabic),
      JSON.stringify(indonesian),
    ).report.rejected;
    assert.equal(
      rejected.find((r) => r.number === '5377').reason,
      'REFERENCE_METADATA_MISMATCH',
    );
    assert.equal(
      rejected.find((r) => r.number === '5398').reason,
      'EMPTY_OR_INVALID_LANGUAGE_TEXT',
    );
    assert.equal(
      rejected.find((r) => r.number === '5399').reason,
      'MISSING_OR_AMBIGUOUS_IDENTITY',
    );
  },
);

test(
  'REAL PILOT: anchor relevance, exact source pairs, localhost gate and public isolation',
  {
    skip:
      !process.env.DATABASE_URL || !existsSync(preparedPilotPath)
        ? 'DATABASE_URL or prepared local pilot fixture missing'
        : false,
  },
  async () => {
    const prior = { ...process.env };
    const pool = createPool(process.env.DATABASE_URL, 1, 10000);
    let app;
    try {
      const dataset = JSON.parse(await readFile(preparedPilotPath, 'utf8'));
      process.env.NODE_ENV = 'development';
      process.env.APP_DATA_SCOPE = 'local_pilot';
      process.env.APP_SEARCH_MODE = 'lexical';
      app = await createApp(false);
      await app.listen(0, '127.0.0.1');
      const base = `${await app.getUrl()}/api/v1`;
      let pilotId;
      for (const [query, number] of [
        ['Saya mau tahu hadits tentang makan dengan tangan kanan.', '5376'],
        ['Saya ingin tahu hadits tentang menahan amarah.', '6116'],
        ['Kenapa kita harus mendahulukan ibu daripada ayah?', '5971'],
      ]) {
        const response = await fetch(`${base}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 5 }),
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const body = await response.json();
        const anchor = body.data.results.find(
          (row) => row.hadithNumber === number,
        );
        assert.ok(anchor, `Missing anchor ${number} in top 5`);
        const original = dataset.records.find(
          (row) => row.hadithNumber === number,
        );
        assert.equal(anchor.arabicText, original.arabicText);
        assert.equal(anchor.indonesianText, original.indonesianText);
        assert.equal(anchor.isVerified, false);
        assert.equal(anchor.isResearchOnly, true);
        assert.equal(anchor.grade, null);
        pilotId = anchor.id;
        const detail = await (
          await fetch(`${base}/hadiths/${anchor.id}`)
        ).json();
        assert.equal(detail.data.arabicText, original.arabicText);
        assert.equal(detail.data.indonesianText, original.indonesianText);
      }
      const foreignHostStatus = await new Promise((resolve, reject) => {
        http
          .get(
            `${base}/health`,
            { headers: { Host: 'example.invalid' } },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          )
          .on('error', reject);
      });
      assert.equal(foreignHostStatus, 403);
      const client = await pool.connect();
      try {
        await assert.rejects(
          () => importDataset(client, dataset, 'a'.repeat(64)),
          /approved|disetujui|permission/i,
        );
      } finally {
        client.release();
      }
      await app.close();
      app = undefined;
      process.env.APP_DATA_SCOPE = 'published';
      app = await createApp(false);
      await app.listen(0, '127.0.0.1');
      const publicBase = `${await app.getUrl()}/api/v1`;
      assert.equal(
        (await fetch(`${publicBase}/hadiths/${pilotId}`)).status,
        404,
      );
      const response = await fetch(`${publicBase}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'ibu', dataScope: 'local_pilot' }),
      });
      assert.equal(response.status, 400);
      const sources = await (await fetch(`${publicBase}/sources`)).json();
      assert.ok(
        !sources.data.some((row) => row.slug === 'fawaz-bukhari-local'),
      );
      const counts = (
        await pool.query(
          "SELECT (SELECT count(*)::int FROM local_pilot_hadiths) AS pilot, (SELECT count(*)::int FROM published_hadiths WHERE source_slug='fawaz-bukhari-local') AS public, (SELECT permission_status FROM source_catalog WHERE slug='fawaz-bukhari-local') AS permission",
        )
      ).rows[0];
      assert.deepEqual(counts, {
        pilot: 404,
        public: 0,
        permission: 'research_only',
      });
    } finally {
      if (app) await app.close();
      await pool.end();
      for (const key of ['NODE_ENV', 'APP_DATA_SCOPE', 'APP_SEARCH_MODE']) {
        if (prior[key] === undefined) delete process.env[key];
        else process.env[key] = prior[key];
      }
    }
  },
);
