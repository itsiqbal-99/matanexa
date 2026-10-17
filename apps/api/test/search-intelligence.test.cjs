const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  QueryNormalizer,
  normalizeSearchText,
} = require('../dist/modules/search/query-normalizer');
const { QueryAnalyzer } = require('../dist/modules/search/query-analyzer');
const { SynonymService } = require('../dist/modules/search/synonym.service');
const { RelevanceRanker } = require('../dist/modules/search/relevance-ranker');
const {
  SearchRepository,
  retrievalTerms,
} = require('../dist/modules/search/search.repository');
const { searchSchema } = require('../dist/modules/search/search.schema');
const {
  evaluateMetrics,
  percentile,
} = require('../dist/modules/search/evaluation/metrics');
const { loadFixtures } = require('../dist/modules/search/evaluation/fixtures');
const analyzer = new QueryAnalyzer(new QueryNormalizer(), new SynonymService());

test('normalization preserves original input and meanings of negation without aggressive stemming', () => {
  const original = '  Minta dong hadist soal jangan gampang MARAH!  ';
  const parsed = searchSchema.parse({ query: original });
  assert.equal(parsed.query, original);
  const result = analyzer.analyze(parsed.query);
  assert.equal(result.original, original);
  assert.equal(
    result.normalized,
    'minta dong hadits tentang jangan gampang marah',
  );
  assert.deepEqual(result.negations, ['jangan']);
  assert.ok(result.primaryTerms.includes('marah'));
  assert.equal(result.primaryTerms.includes('dong'), false);
  assert.equal(
    normalizeSearchText(' ＩＬＭＵ\n\u200b belajar!? '),
    'ilmu belajar',
  );
  for (const [query, expected] of [
    ['tidak marah', 'tidak'],
    ['jgn marah', 'jangan'],
    ['bukan sedekah', 'bukan'],
    ['nggak marah', 'tidak'],
    ['tanpa bohong', 'tanpa'],
    ['belum belajar', 'belum'],
  ])
    assert.ok(analyzer.analyze(query).negations.includes(expected));
  assert.ok(
    analyzer.analyze('kewajiban belajar').primaryTerms.includes('kewajiban'),
  );
});

test('equivalent terms and weaker topical relationships are kept separate and context bounded', () => {
  const synonyms = new SynonymService();
  const charity = synonyms.expand('infaq');
  assert.ok(charity.equivalents.includes('infak'));
  assert.equal(charity.equivalents.includes('sedekah'), false);
  assert.ok(charity.related.includes('sedekah'));
  const parents = synonyms.expand('ibu');
  assert.ok(parents.equivalents.includes('bunda'));
  assert.equal(parents.equivalents.includes('ayah'), false);
  assert.deepEqual(synonyms.expand('ibu kota').topicSlugs, []);
  assert.deepEqual(synonyms.expand('ibukota').topicSlugs, []);
  assert.deepEqual(synonyms.expand('memberi').topicSlugs, []);
  assert.deepEqual(synonyms.expand('kanan').topicSlugs, []);
  assert.ok(synonyms.expand('tangan kanan').topicSlugs.includes('eating'));
});

test('explicit typo corrections route supported topics; unknown words are not rewritten', () => {
  for (const [query, topic] of [
    ['hadis belajr', 'knowledge'],
    ['hadits sedekha', 'charity'],
    ['hadist mrah', 'anger'],
    ['hadis lisn', 'speech'],
  ])
    assert.ok(analyzer.analyze(query).topicSlugs.includes(topic));
  assert.equal(analyzer.analyze('makam').normalized, 'makam');
  assert.deepEqual(analyzer.analyze('makam').topicSlugs, []);
});

test('ambiguous requests have no invented intent and still contact PostgreSQL', async () => {
  let calls = 0;
  const repo = new SearchRepository(
    {
      query: async () => {
        calls++;
        throw new Error('SIMULASI DATABASE DOWN');
      },
    },
    new RelevanceRanker(),
  );
  for (const query of [
    'hadits ini dong',
    'apakah ada hadits',
    'jangan',
    'orang baik',
  ])
    assert.equal(analyzer.analyze(query).ambiguous, true);
  await assert.rejects(
    () =>
      repo.search(
        { query: 'hadits ini dong', page: 1, limit: 10 },
        analyzer.analyze('hadits ini dong'),
      ),
    /DATABASE DOWN/,
  );
  assert.equal(calls, 1);
});

test('ranker favors coverage and exact phrases over weak relations, with no grading signal', () => {
  const ranker = new RelevanceRanker();
  const zero = {
    primary: 0,
    phrase: 0,
    equivalent: 0,
    topic: 0,
    related: 0,
    chapter: 0,
    fts: 0,
    typo: 0,
    negation: 0,
    negationMissing: 0,
  };
  assert.ok(
    ranker.score({ ...zero, primary: 1, phrase: 1 }) >
      ranker.score({ ...zero, related: 1 }),
  );
  assert.ok(
    ranker.score({ ...zero, primary: 1, negation: 1 }) >
      ranker.score({ ...zero, primary: 1, negationMissing: 1 }),
  );
  assert.equal('grade' in ranker.weights, false);
  const terms = retrievalTerms(
    analyzer.analyze("ilmu'; DROP TABLE hadiths; --"),
  );
  assert.doesNotMatch(terms, /[;'()]/);
});

test('fixture evaluation has 64 explicit judgments and no fabricated real hadith IDs', () => {
  const data = loadFixtures(
    JSON.parse(
      readFileSync(
        resolve(__dirname, '../../../tests/fixtures/g3-search.json'),
        'utf8',
      ),
    ),
  );
  assert.equal(data.cases.length, 64);
  assert.equal(data.cases.filter((row) => row.split === 'holdout').length, 16);
  const ids = new Set(data.documents.map((row) => row.id));
  for (const row of data.cases) {
    assert.equal(row.expectedHadithIdsVerified, null);
    assert.equal(row.judgments.length, 32);
    assert.ok(
      row.partiallyRelevantFixtureIds.every(
        (id) => !row.expectedFixtureIds.includes(id),
      ),
    );
    assert.ok(
      row.expectedFixtureIds.every(
        (id) => id.startsWith('SIM-') && ids.has(id),
      ),
    );
    const actual = analyzer.analyze(row.query);
    if (row.expectedTopic)
      assert.ok(actual.topicSlugs.includes(row.expectedTopic), row.query);
    else assert.deepEqual(actual.topicSlugs, [], row.query);
  }
  assert.ok(
    data.cases.some((row) =>
      row.judgments.some((judgment) => judgment.relevance === 'partial'),
    ),
  );
  assert.ok(
    data.documents.every((row) => row.indonesian_text.startsWith('SIMULASI')),
  );
});

test('quality metrics use judged positives, correct denominators, unique hits and nearest-rank latency', () => {
  const rows = [
    {
      id: 'SIM-1',
      category: 'test',
      split: 'calibration',
      query: 'SIMULASI',
      expectedIds: ['a', 'b'],
      actualIds: ['x', 'b', 'b', 'a'],
      expectedTopic: 'test',
      actualTopics: ['test'],
      latencyMs: 10,
    },
    {
      id: 'SIM-2',
      category: 'negative',
      split: 'holdout',
      query: 'SIMULASI',
      expectedIds: [],
      actualIds: [],
      expectedTopic: null,
      actualTopics: [],
      latencyMs: 50,
    },
  ];
  const metrics = evaluateMetrics(rows);
  assert.equal(metrics.precisionAt5, 0.4);
  assert.equal(metrics.recallAt10, 1);
  assert.equal(metrics.mrrAt10, 0.5);
  assert.equal(metrics.hitRateAt5, 1);
  assert.equal(metrics.zeroResultRate, 0.5);
  assert.equal(metrics.noResultAccuracy, 1);
  assert.equal(metrics.positiveJudgedQueries, 1);
  assert.deepEqual(metrics.latencyMs, { p50: 10, p95: 50 });
  assert.equal(evaluateMetrics([]).recallAt10, null);
  assert.equal(percentile([], 0.95), null);
});
