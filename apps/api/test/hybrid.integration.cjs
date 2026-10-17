const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ServiceUnavailableException } = require('@nestjs/common');
const { writeFile, mkdir } = require('node:fs/promises');
const { resolve } = require('node:path');
require('dotenv').config({ quiet: true });
const { createApp } = require('../dist/create-app');
const {
  CloudflareEmbedding,
  EmbeddingUnavailable,
} = require('../dist/providers/embedding/cloudflare-embedding');
const {
  SemanticRepository,
} = require('../dist/modules/search/semantic.repository');

test(
  'REAL HYBRID HTTP: live semantic anchors, controlled provider failures, DB errors and public vector isolation',
  {
    skip:
      !process.env.DATABASE_URL || !process.env.CLOUDFLARE_API_TOKEN
        ? 'Database/Cloudflare configuration required'
        : false,
  },
  async () => {
    const previous = { ...process.env };
    let app;
    let providerStats;
    try {
      process.env.NODE_ENV = 'development';
      process.env.APP_DATA_SCOPE = 'local_pilot';
      process.env.APP_SEARCH_MODE = 'hybrid';
      app = await createApp(false);
      await app.listen(0, '127.0.0.1');
      const base = `${await app.getUrl()}/api/v1`;
      const search = (query) =>
        fetch(`${base}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 5 }),
        });
      for (const [query, number] of [
        ['makan dengan tangan kanan', '5376'],
        ['menahan amarah', '6116'],
        ['mendahulukan ibu daripada ayah', '5971'],
      ]) {
        const response = await search(query);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.meta.modeUsed, 'hybrid');
        assert.ok(
          body.data.results.some((r) => r.hadithNumber === number),
          `Anchor ${number} missing in hybrid top5`,
        );
        assert.ok(
          body.data.results.every(
            (r) =>
              r.isResearchOnly === true &&
              r.isVerified === false &&
              r.grade === null,
          ),
        );
      }
      const provider = app.get(CloudflareEmbedding),
        semantic = app.get(SemanticRepository);
      providerStats = provider.statistics;
      for (const code of ['TIMEOUT', 'INVALID_RESPONSE', 'REMOTE_ERROR']) {
        provider.embed = async () => {
          throw new EmbeddingUnavailable(code);
        };
        const response = await search('makan dengan tangan kanan');
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.meta.modeUsed, 'lexical_fallback');
        assert.equal(body.meta.fallbackReason, code);
        assert.ok(body.data.results.some((r) => r.hadithNumber === '5376'));
      }
      provider.embed = async () => [Array(1024).fill(0.01)];
      semantic.search = async () => {
        throw new ServiceUnavailableException('SIMULATION_VECTOR_DB_DOWN');
      };
      const failed = await search('makan dengan tangan kanan');
      assert.equal(failed.status, 503);
      assert.ok(!(await failed.text()).includes('SIMULATION_VECTOR_DB_DOWN'));
      await app.close();
      app = undefined;
      process.env.APP_DATA_SCOPE = 'published';
      app = await createApp(false);
      await app.listen(0, '127.0.0.1');
      assert.deepEqual(
        await app.get(SemanticRepository).search(Array(1024).fill(0.01)),
        [],
      );
      assert.equal(await app.get(SemanticRepository).ready(), false);
      const out = resolve(__dirname, '../../../artifacts/g26-hybrid');
      await mkdir(out, { recursive: true });
      await writeFile(
        resolve(out, 'integration-api.json'),
        JSON.stringify(
          {
            liveQueries: 3,
            forcedFailureQueries: 3,
            forcedDatabaseFailureQueries: 1,
            api: providerStats,
          },
          null,
          2,
        ),
      );
    } finally {
      if (app) await app.close();
      for (const key of ['NODE_ENV', 'APP_DATA_SCOPE', 'APP_SEARCH_MODE']) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  },
);
