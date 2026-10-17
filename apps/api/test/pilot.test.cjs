const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readEnvironment } = require('../dist/config/environment');
const { CorpusAccess } = require('../dist/database/corpus-access');
const {
  CloudflareEmbedding,
  EmbeddingUnavailable,
} = require('../dist/providers/embedding/cloudflare-embedding');
const {
  reciprocalRankFusion,
} = require('../dist/modules/search/semantic.repository');
const {
  normalizeIndexText,
} = require('../dist/modules/search/query-normalizer');
test('search index retains nested dialogue and never edits the original text', () => {
  const source =
    'SIMULASI [narator] berkata; "Pembuka; "Pertanyaan?" jawab: "Ibumu." lalu "Ayahmu."';
  const index = normalizeIndexText(source);
  assert.ok(index.includes('ibu'));
  assert.ok(index.includes('ayah'));
  assert.ok(!index.includes('narator'));
  assert.ok(source.includes('Ibumu.'));
});
test('pilot is opt-in, development-only and cannot select published data with a query flag', () => {
  assert.equal(
    new CorpusAccess(readEnvironment({})).relation,
    'published_hadiths',
  );
  for (const env of [
    { APP_DATA_SCOPE: 'local_pilot' },
    { NODE_ENV: 'production', APP_DATA_SCOPE: 'local_pilot' },
    { APP_DATA_SCOPE: 'anything' },
  ])
    assert.throws(() => readEnvironment(env));
  assert.equal(
    new CorpusAccess(
      readEnvironment({
        NODE_ENV: 'development',
        APP_DATA_SCOPE: 'local_pilot',
      }),
    ).relation,
    'local_pilot_hadiths',
  );
});
test('embedding provider missing config makes zero remote calls', async () => {
  let calls = 0;
  const provider = new CloudflareEmbedding({}, async () => {
    calls++;
    throw Error('must not call');
  });
  await assert.rejects(
    () => provider.embed(['test']),
    (e) => e instanceof EmbeddingUnavailable && e.code === 'NOT_CONFIGURED',
  );
  assert.equal(calls, 0);
});
test('embedding REST validates 1024 finite nonzero dimensions, count and provider errors', async () => {
  const env = {
    cloudflareAccountId: 'a'.repeat(32),
    cloudflareApiToken: 'SIMULATION_ONLY',
  };
  const valid = Array(1024).fill(0.01);
  const provider = new CloudflareEmbedding(env, async (url, options) => {
    assert.ok(url.endsWith('/@cf/baai/bge-m3'));
    assert.deepEqual(JSON.parse(options.body), { text: ['SIMULATION'] });
    return new Response(
      JSON.stringify({ success: true, result: { data: [valid] } }),
    );
  });
  assert.equal((await provider.embed(['SIMULATION']))[0].length, 1024);
  for (const payload of [
    { success: true, result: { data: [valid.slice(1)] } },
    { success: true, result: { data: [Array(1024).fill(0)] } },
    { success: true, result: { data: [] } },
    { success: false },
  ]) {
    await assert.rejects(
      () =>
        new CloudflareEmbedding(
          env,
          async () => new Response(JSON.stringify(payload)),
        ).embed(['SIMULATION']),
      (e) => e.code === 'INVALID_RESPONSE',
    );
  }
  await assert.rejects(
    () =>
      new CloudflareEmbedding(
        env,
        async () => new Response('', { status: 429 }),
      ).embed(['SIMULATION']),
    (e) => e.code === 'REMOTE_ERROR',
  );
  await assert.rejects(
    () =>
      new CloudflareEmbedding(env, async () => {
        throw new DOMException('timeout', 'TimeoutError');
      }).embed(['SIMULATION']),
    (e) => e.code === 'TIMEOUT',
  );
});
test('RRF deduplicates ids, rewards both lists and retains independent collections', () => {
  const a = { id: 'a' },
    b = { id: 'b' },
    c = { id: 'c' };
  const fused = reciprocalRankFusion([a, b, a], [b, c]);
  assert.equal(fused[0].id, 'b');
  assert.deepEqual(new Set(fused.map((x) => x.id)), new Set(['a', 'b', 'c']));
});

test('hybrid service falls back for provider failures, avoids calls without index, and never hides DB failures', async () => {
  const { SearchService } = require('../dist/modules/search/search.service');
  const { QueryAnalyzer } = require('../dist/modules/search/query-analyzer');
  const {
    QueryNormalizer,
  } = require('../dist/modules/search/query-normalizer');
  const { SynonymService } = require('../dist/modules/search/synonym.service');
  const analyzer = new QueryAnalyzer(
    new QueryNormalizer(),
    new SynonymService(),
  );
  const env = { mode: 'hybrid', dataScope: 'local_pilot' };
  const dto = { query: 'makan', limit: 5, page: 1 };
  const lexical = { search: async () => ({ results: [], total: 0 }) };
  for (const code of ['TIMEOUT', 'INVALID_RESPONSE', 'REMOTE_ERROR']) {
    const service = new SearchService(
      {},
      lexical,
      analyzer,
      env,
      {
        configured: true,
        embed: async () => {
          throw new EmbeddingUnavailable(code);
        },
      },
      { ready: async () => true },
    );
    const body = await service.search(dto);
    assert.equal(body.meta.modeUsed, 'lexical_fallback');
    assert.equal(body.meta.fallbackReason, code);
  }
  let calls = 0;
  const provider = {
    configured: true,
    embed: async () => {
      calls++;
      return [Array(1024).fill(0.01)];
    },
  };
  const service = new SearchService({}, lexical, analyzer, env, provider, {
    ready: async () => false,
  });
  assert.equal(
    (await service.search(dto)).meta.fallbackReason,
    'INDEX_NOT_READY',
  );
  assert.equal(calls, 0);
  await assert.rejects(
    () =>
      new SearchService(
        {},
        {
          search: async () => {
            throw Error('DB_UNAVAILABLE');
          },
        },
        analyzer,
        env,
        provider,
        { ready: async () => true },
      ).search(dto),
    /DB_UNAVAILABLE/,
  );
  await assert.rejects(
    () =>
      new SearchService({}, lexical, analyzer, env, provider, {
        ready: async () => true,
        search: async () => {
          throw Error('VECTOR_DB_UNAVAILABLE');
        },
      }).search(dto),
    /VECTOR_DB_UNAVAILABLE/,
  );
});

test('embedding telemetry retains only counts and numeric usage, never token or text', async () => {
  const secret = 'SIMULATION_PRIVATE_TOKEN';
  const p = new CloudflareEmbedding(
    { cloudflareAccountId: 'a'.repeat(32), cloudflareApiToken: secret },
    async () =>
      new Response(
        JSON.stringify({
          success: true,
          result: {
            data: [Array(1024).fill(0.1)],
            meta: { input_tokens: 8, neurons: 0.02, secret },
          },
        }),
      ),
  );
  await p.embed(['SIMULATION_PRIVATE_TEXT']);
  assert.equal(p.statistics.requests, 1);
  assert.equal(p.statistics.successfulRequests, 1);
  assert.equal(p.statistics.usageReported, true);
  assert.equal(p.statistics.reportedInputTokens, 8);
  assert.equal(p.statistics.reportedNeurons, 0.02);
  assert.ok(!JSON.stringify(p.statistics).includes(secret));
  assert.ok(!JSON.stringify(p.statistics).includes('SIMULATION_PRIVATE_TEXT'));
});

test('hybrid without index uses paged lexical results once, with no deep candidate scan', async () => {
  const { SearchService } = require('../dist/modules/search/search.service');
  const found = { results: [{ id: 'unused' }], total: 21 };
  // Empty result payload avoids serializing a fabricated hadith row.
  found.results = [];
  const calls = [];
  const service = new SearchService(
    {},
    {
      search: async (dto) => {
        calls.push(dto);
        return found;
      },
    },
    { analyze: () => ({ ambiguous: false }) },
    { mode: 'hybrid' },
    { configured: true },
    { ready: async () => false },
  );
  const dto = { query: 'SIMULATION', page: 2, limit: 10 };
  const body = await service.search(dto);
  assert.deepEqual(calls, [dto]);
  assert.equal(body.meta.modeUsed, 'lexical_fallback');
  assert.equal(body.meta.page, 2);
  assert.equal(body.data.totalCandidates, 21);
});

test('provider failure beyond candidate depth re-fetches the requested lexical page', async () => {
  const { SearchService } = require('../dist/modules/search/search.service');
  const calls = [];
  const repository = {
    search: async (dto) => {
      calls.push(dto);
      return { results: [], total: 201 };
    },
  };
  const service = new SearchService(
    {},
    repository,
    { analyze: () => ({ ambiguous: false, normalized: 'SIMULATION' }) },
    { mode: 'hybrid' },
    {
      configured: true,
      embed: async () => {
        throw new EmbeddingUnavailable('TIMEOUT');
      },
    },
    { ready: async () => true },
  );
  const dto = { query: 'SIMULATION', page: 7, limit: 20 };
  const body = await service.search(dto);
  assert.equal(calls[0].limit, 100);
  assert.deepEqual(calls[1], dto);
  assert.equal(body.meta.modeUsed, 'lexical_fallback');
  assert.equal(body.meta.page, 7);
  assert.equal(body.meta.hasMore, true);
});
