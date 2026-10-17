const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
require('dotenv').config({ quiet: true });
const { createSessionPool } = require('../dist/database/connection');
const {
  loadFixtures,
  preparePostgresFixtures,
  EVALUATION_SQL,
} = require('../dist/modules/search/evaluation/fixtures');
const {
  searchParameters,
} = require('../dist/modules/search/search.repository');
const { QueryAnalyzer } = require('../dist/modules/search/query-analyzer');
const { QueryNormalizer } = require('../dist/modules/search/query-normalizer');
const { SynonymService } = require('../dist/modules/search/synonym.service');
const { RelevanceRanker } = require('../dist/modules/search/relevance-ranker');

test(
  'REAL NEON TEMP SIMULATION: ranking, negation, identity dedup, cross-collection preservation, filters and pagination',
  {
    skip: !process.env.TEST_DATABASE_URL ? 'TEST_DATABASE_URL missing' : false,
  },
  async () => {
    const fixture = loadFixtures(
      JSON.parse(
        readFileSync(
          resolve(__dirname, '../../../tests/fixtures/g3-search.json'),
          'utf8',
        ),
      ),
    );
    // Same text across collections must survive; same source identity must be deduplicated.
    for (const field of [
      'book_name',
      'chapter_name',
      'indonesian_text',
      'normalized_translation',
    ])
      fixture.documents[4][field] = fixture.documents[0][field];
    const pool = createSessionPool(process.env.TEST_DATABASE_URL);
    try {
      const client = await pool.connect();
      try {
        await preparePostgresFixtures(client, fixture.documents);
        const analyzer = new QueryAnalyzer(
          new QueryNormalizer(),
          new SynonymService(),
        );
        const weights = new RelevanceRanker().weights;
        const search = async (query, options = {}) =>
          (
            await client.query(
              EVALUATION_SQL,
              searchParameters(
                { query, page: 1, limit: 20, ...options },
                analyzer.analyze(query),
                weights,
              ),
            )
          ).rows[0];
        const all = await search('ilmu');
        const parents = await search('Hadits tentang hormat sama ibu');
        assert.equal(parents.total, 5);
        assert.ok(
          parents.results.every((row) => row.id.startsWith('SIM-parents-')),
        );
        assert.equal(all.total, 5);
        for (const row of all.results) {
          const score = new RelevanceRanker().score(
            {
              primary: row.primary_signal,
              phrase: row.phrase_signal,
              equivalent: row.equivalent_signal,
              topic: row.topic_signal,
              related: row.related_signal,
              chapter: row.chapter_signal,
              fts: row.fts_signal,
              typo: row.typo_signal,
              negation: row.negation_signal,
              negationMissing: 0,
            },
            weights,
            [...row.document_text].length,
          );
          assert.ok(
            Math.abs(score - row.relevance) < 0.00001,
            'SQL/JS ranking formula drift',
          );
        }
        assert.ok(all.results.some((row) => row.id === 'SIM-knowledge-1'));
        assert.ok(all.results.some((row) => row.id === 'SIM-knowledge-5'));
        assert.equal(
          all.results.some((row) => row.id.includes('duplicate')),
          false,
        );
        const page = await search('ilmu', { limit: 2, page: 2 });
        assert.equal(page.total, 5);
        assert.deepEqual(
          page.results.map((r) => r.id),
          all.results.slice(2, 4).map((r) => r.id),
        );
        const beyond = await search('ilmu', { page: 10 });
        assert.equal(beyond.total, 5);
        assert.deepEqual(beyond.results, []);
        assert.equal(
          (await search('jangan marah')).results[0].id,
          'SIM-anger-1',
        );
        assert.equal((await search('Minta hadist soal belajar')).total, 5);
        assert.equal(
          (
            await search('ilmu', {
              filters: { sourceSlugs: ['unavailable-source'] },
            })
          ).total,
          0,
        );
        assert.equal((await search('hadits tentang ini dong')).total, 0);
        assert.equal((await search('mobil listrik')).total, 0);
        assert.equal(
          (await search("ilmu'; DROP TABLE hadiths; --")).results.some((row) =>
            row.id.startsWith('SIM-knowledge'),
          ),
          true,
        );
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  },
);
