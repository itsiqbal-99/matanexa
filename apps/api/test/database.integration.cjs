const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const { resolve } = require('node:path');
require('dotenv').config({ quiet: true });
const { createSessionPool } = require('../dist/database/connection');
const { migrate, readMigrations } = require('../dist/database/migrations');
const { importDataset } = require('../dist/database/importer');
const {
  HadithRepository,
} = require('../dist/modules/hadiths/hadith.repository');
const { fixture } = require('./fixtures.cjs');
const {
  SearchRepository,
} = require('../dist/modules/search/search.repository');
const { QueryAnalyzer } = require('../dist/modules/search/query-analyzer');
const { QueryNormalizer } = require('../dist/modules/search/query-normalizer');
const { SynonymService } = require('../dist/modules/search/synonym.service');
const { RelevanceRanker } = require('../dist/modules/search/relevance-ranker');

test(
  'REAL NEON: migrations, draft import/idempotency, publication isolation, FTS ranking and parameterization',
  {
    skip: !process.env.TEST_DATABASE_URL
      ? 'TEST_DATABASE_URL belum tersedia; tidak ada pengujian PostgreSQL nyata'
      : false,
  },
  async () => {
    // TEST_DATABASE_URL must point to a dedicated Neon test branch. Never use DATABASE_URL implicitly.
    const pool = createSessionPool(process.env.TEST_DATABASE_URL);
    const client = await pool.connect();
    const schema = `matanexa_g2_test_${randomBytes(8).toString('hex')}`;
    assert.match(schema, /^matanexa_g2_test_[a-f0-9]{16}$/);
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema},public`);
      const migrations = await readMigrations(
        resolve(__dirname, '../../../db/migrations'),
      );
      assert.equal(
        (await migrate(client, migrations)).length,
        migrations.length,
      );
      assert.deepEqual(await migrate(client, migrations), []);
      await client.query(`INSERT INTO source_catalog(slug,display_name,original_url,license_name,license_reference_url,
      permission_status,attribution,permission_evidence_url,permission_notes,checked_at)
      VALUES('simulation-test','SIMULASI SUMBER','https://example.invalid/simulation','SIMULASI TEST ONLY',
      'https://example.invalid/license','approved','SIMULASI','https://example.invalid/permission','SIMULASI',now())`);
      const dataset = {
        sourceSlug: 'simulation-test',
        datasetVersion: 'SIMULASI-V1',
        datasetUrl: 'https://example.invalid/dataset',
        records: [fixture(), fixture(), { bad: true }],
      };
      const dryRun = await importDataset(client, dataset, 'a'.repeat(64), {
        dryRun: true,
      });
      assert.equal(dryRun.dryRun, true);
      assert.equal(dryRun.committed, false);
      assert.deepEqual(
        [dryRun.imported, dryRun.duplicated, dryRun.failed],
        [1, 1, 1],
      );
      assert.ok(dryRun.failures[0].fields.includes('arabicText'));
      assert.equal(
        (await client.query('SELECT count(*)::int AS total FROM hadiths'))
          .rows[0].total,
        0,
      );
      assert.equal(
        (await client.query('SELECT count(*)::int AS total FROM import_runs'))
          .rows[0].total,
        0,
      );
      const report = await importDataset(client, dataset, 'a'.repeat(64));
      assert.equal(report.committed, true);
      assert.deepEqual(
        [report.imported, report.duplicated, report.failed],
        [1, 1, 1],
      );
      const repeated = await importDataset(
        client,
        { ...dataset, records: [fixture()] },
        'a'.repeat(64),
      );
      assert.deepEqual([repeated.imported, repeated.skipped], [0, 1]);
      await client.query('UPDATE hadiths SET is_simulation=true');
      const repository = new HadithRepository({
        query: async (sql, values) => (await client.query(sql, values)).rows,
      });
      const search = new SearchRepository(
        {
          query: async (sql, values) => (await client.query(sql, values)).rows,
        },
        new RelevanceRanker(),
      );
      const analyzer = new QueryAnalyzer(
        new QueryNormalizer(),
        new SynonymService(),
      );
      assert.deepEqual(
        await search.search(
          { query: 'ilmu', page: 1, limit: 10 },
          analyzer.analyze('ilmu'),
        ),
        { results: [], total: 0 },
      );
      assert.deepEqual(await repository.sources(), []);
      const id = (await client.query('SELECT id FROM hadiths')).rows[0].id;
      assert.equal(await repository.find(id), undefined);
      await assert.rejects(
        () =>
          client.query(`UPDATE hadiths SET verification_status='verified',verified_by='SIMULASI',
      verified_at=now(),verification_reference_url='https://example.invalid/review'`),
        (error) => error.code === '23514',
      );
      const ranked = await client.query(
        `SELECT marker,ts_rank_cd(to_tsvector('simple',body),to_tsquery('simple',$1)) AS rank
      FROM (VALUES('SIMULASI-RELEVAN','SIMULASI ilmu belajar'),('SIMULASI-LAIN','SIMULASI kendaraan')) AS f(marker,body)
      ORDER BY rank DESC,marker`,
        ['ilmu | belajar'],
      );
      assert.equal(ranked.rows[0].marker, 'SIMULASI-RELEVAN');
      assert.ok(ranked.rows[0].rank > ranked.rows[1].rank);
      assert.deepEqual(
        (
          await search.search(
            {
              query: "' OR 1=1; DROP TABLE hadiths; --",
              page: 1,
              limit: 10,
            },
            analyzer.analyze("' OR 1=1; DROP TABLE hadiths; --"),
          )
        ).results,
        [],
      );
      assert.equal(
        (await client.query('SELECT count(*)::int AS total FROM hadiths'))
          .rows[0].total,
        1,
      );
      await client.query(
        "UPDATE source_catalog SET permission_status='candidate'",
      );
      await assert.rejects(
        () => importDataset(client, dataset, 'a'.repeat(64)),
        /SOURCE_NOT_APPROVED/,
      );
      console.log(
        JSON.stringify({
          kind: 'SIMULATION_ONLY_NEON_TEST',
          realRecordsImported: 0,
          report,
          dryRun,
        }),
      );
    } finally {
      // Only this freshly generated test schema is removed; no reset of application tables.
      await client.query('ROLLBACK');
      await client.query('SET search_path TO public');
      if (/^matanexa_g2_test_[a-f0-9]{16}$/.test(schema))
        await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      client.release();
      await pool.end();
    }
  },
);
