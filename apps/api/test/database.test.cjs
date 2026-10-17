const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  poolOptions,
  sessionPoolOptions,
} = require('../dist/database/connection');
const { DatabaseService } = require('../dist/database/database.service');
const { migrate, readMigrations } = require('../dist/database/migrations');
const {
  importRecordSchema,
  importDataset,
  contentHash,
  recordIdentity,
} = require('../dist/database/importer');
const {
  HadithRepository,
  serializeHadith,
} = require('../dist/modules/hadiths/hadith.repository');
const {
  SearchRepository,
  LEXICAL_SQL,
} = require('../dist/modules/search/search.repository');
const { QueryAnalyzer } = require('../dist/modules/search/query-analyzer');
const { QueryNormalizer } = require('../dist/modules/search/query-normalizer');
const { SynonymService } = require('../dist/modules/search/synonym.service');
const { RelevanceRanker } = require('../dist/modules/search/relevance-ranker');
const analyzer = new QueryAnalyzer(new QueryNormalizer(), new SynonymService());
const { createApp } = require('../dist/create-app');
const { fixture } = require('./fixtures.cjs');

test('Neon connection validates TLS, bounded pool configuration and no secret errors', async () => {
  assert.equal(
    new URL(
      sessionPoolOptions(
        'postgresql://test:simulation@ep-test-pooler.neon.tech/test',
      ).connectionString,
    ).hostname,
    'ep-test.neon.tech',
  );
  assert.equal(
    sessionPoolOptions('postgresql://test:simulation@ep-test.neon.tech/test')
      .ssl.rejectUnauthorized,
    true,
  );
  const options = poolOptions(
    'postgresql://test:simulation@ep-test.neon.tech/test?sslmode=require',
  );
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.max, 3);
  assert.equal(options.connectionTimeoutMillis, 10000);
  assert.equal(options.statement_timeout, 5000);
  assert.equal(new URL(options.connectionString).search, '');
  for (const url of [
    'bad',
    'postgres://a:b@localhost/test',
    'postgresql://a:b@ep-test.neon.tech/test?sslmode=disable',
    'postgresql://a:b@ep-test.neon.tech.evil.com/test',
    'postgresql://a:b@ep-test.neon.tech/test?sslcert=x',
  ])
    assert.throws(
      () => poolOptions(url),
      (error) => !error.message.includes(url),
    );
  const db = new DatabaseService({ mode: 'mock' });
  await assert.rejects(
    () => db.query('SELECT 1'),
    (error) =>
      error.getStatus() === 503 && error.message === 'DATABASE_UNAVAILABLE',
  );
  await db.onModuleDestroy();
});

test('migration runner checksum, idempotency, drift detection and rollback (client double)', async () => {
  const migrations = await readMigrations(
    resolve(__dirname, '../../../db/migrations'),
  );
  assert.equal(migrations.length, 5);
  assert.doesNotMatch(
    migrations
      .slice(0, 3)
      .map((m) => m.sql)
      .join(''),
    /CREATE EXTENSION.*vector|DROP TABLE/i,
  );
  const history = [];
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push(sql);
      if (sql.startsWith('SELECT name,checksum')) return { rows: history };
      if (sql.startsWith('INSERT INTO schema_migrations'))
        history.push({ name: values[0], checksum: values[1] });
      return { rows: [] };
    },
  };
  assert.deepEqual(
    await migrate(client, migrations),
    migrations.map((m) => m.name),
  );
  assert.deepEqual(await migrate(client, migrations), []);
  await assert.rejects(
    () =>
      migrate(client, [
        { ...migrations[0], checksum: 'changed' },
        migrations[1],
      ]),
    /mismatch/,
  );
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.match(
    migrations[0].sql,
    /verification_status='verified' AND s.permission_status='approved'/,
  );
  assert.match(migrations[0].sql, /AND NOT h.is_simulation/);
});

// SQL protocol double: proves pipeline behavior, NOT PostgreSQL execution.
function importClient(approved = true) {
  const records = new Map();
  const calls = [];
  return {
    records,
    calls,
    query: async (sql, values = []) => {
      calls.push(sql);
      if (sql.includes('SELECT id FROM source_catalog'))
        return { rows: approved ? [{ id: randomUUID() }] : [] };
      if (sql.startsWith('INSERT INTO import_runs'))
        return { rows: [{ id: randomUUID() }] };
      if (sql.startsWith('INSERT INTO hadith_collections'))
        return { rows: [{ id: 'simulation-collection' }] };
      if (sql.startsWith('SELECT id,content_hash'))
        return { rows: records.has(values[3]) ? [records.get(values[3])] : [] };
      if (sql.startsWith('INSERT INTO hadiths'))
        records.set(values[3], { id: randomUUID(), content_hash: values[15] });
      return { rows: [] };
    },
  };
}
test('import validates fields, retains originals, detects duplicates and is idempotent (client double)', async () => {
  const dryClient = importClient();
  const dryReport = await importDataset(
    dryClient,
    {
      sourceSlug: 'simulation-test',
      datasetVersion: 'SIMULASI',
      datasetUrl: 'https://example.invalid/simulation',
      records: [fixture()],
    },
    'a'.repeat(64),
    { dryRun: true },
  );
  assert.equal(dryReport.committed, false);
  assert.equal(dryReport.dryRun, true);
  assert.equal(dryClient.calls.at(-1), 'ROLLBACK');
  assert.equal(dryClient.calls.includes('COMMIT'), false);
  const record = fixture();
  assert.equal(importRecordSchema.safeParse(record).success, true);
  assert.equal(
    importRecordSchema.safeParse({ ...record, verificationStatus: 'verified' })
      .success,
    false,
  );
  assert.equal(
    importRecordSchema.safeParse({ ...record, grade: { text: 'SIMULASI' } })
      .success,
    false,
  );
  assert.equal(
    importRecordSchema.safeParse({
      ...record,
      referenceUrl: 'javascript:alert(1)',
    }).success,
    false,
  );
  assert.equal(
    recordIdentity({ ...record, hadithNumber: 'SIMULASI-1a' }).includes(
      'SIMULASI-1a',
    ),
    true,
  );
  assert.equal(contentHash(record), contentHash({ ...record }));
  const client = importClient();
  const dataset = {
    sourceSlug: 'simulation-test',
    datasetVersion: 'test-v1',
    datasetUrl: 'https://example.invalid/simulation',
    records: [
      record,
      record,
      { bad: true },
      { ...record, indonesianText: 'SIMULASI BERBEDA' },
    ],
  };
  const first = await importDataset(client, dataset, 'a'.repeat(64));
  assert.deepEqual(
    [first.imported, first.skipped, first.duplicated, first.failed],
    [1, 0, 1, 2],
  );
  const second = await importDataset(
    client,
    { ...dataset, records: [record] },
    'a'.repeat(64),
  );
  assert.deepEqual([second.imported, second.skipped], [0, 1]);
  const changed = await importDataset(
    client,
    { ...dataset, records: [{ ...record, chapterName: 'SIMULASI REVISI' }] },
    'b'.repeat(64),
  );
  assert.equal(changed.updated, 1);
  await assert.rejects(
    () => importDataset(importClient(false), dataset, 'a'.repeat(64)),
    /SOURCE_NOT_APPROVED/,
  );
});

test('lexical terms, injection parameters, pagination, mapping and empty results (repository double)', async () => {
  assert.equal(
    analyzer.analyze('Kasih hadits tentang menuntut ilmu').topicSlugs[0],
    'knowledge',
  );
  assert.equal(analyzer.analyze('hadits tentang').ambiguous, true);
  const calls = [];
  const repo = new SearchRepository(
    {
      query: async (sql, values) => {
        calls.push({ sql, values });
        return [{ total: 0, results: [] }];
      },
    },
    new RelevanceRanker(),
  );
  const injection = "' OR 1=1; DROP TABLE hadiths; --";
  assert.deepEqual(
    await repo.search(
      {
        query: injection,
        page: 2,
        limit: 5,
        filters: { sourceSlugs: [injection] },
      },
      analyzer.analyze(injection),
    ),
    { total: 0, results: [] },
  );
  assert.equal(calls[0].sql, LEXICAL_SQL);
  assert.equal(calls[0].sql.includes(injection), false);
  assert.equal(calls[0].values[1], analyzer.analyze(injection).normalized);
  assert.deepEqual(calls[0].values.slice(2, 5), [[injection], 5, 5]);
  assert.match(LEXICAL_SQL, /ORDER BY relevance DESC/);
  await repo.search(
    { query: 'hadits tentang', page: 1, limit: 10 },
    analyzer.analyze('hadits tentang'),
  );
  assert.equal(calls.length, 2); // DB errors must not be hidden by empty keywords.
});

test('HTTP sources/detail/lexical contract and safe 503 without mock fallback (database double)', async (t) => {
  const oldMode = process.env.APP_SEARCH_MODE,
    oldUrl = process.env.DATABASE_URL;
  process.env.APP_SEARCH_MODE = 'lexical';
  process.env.DATABASE_URL =
    'postgresql://simulation:simulation@ep-test.neon.tech/simulation?sslmode=require';
  const app = await createApp(false);
  if (oldMode === undefined) delete process.env.APP_SEARCH_MODE;
  else process.env.APP_SEARCH_MODE = oldMode;
  if (oldUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = oldUrl;
  t.after(() => app.close());
  const db = app.get(DatabaseService);
  const row = {
    id: randomUUID(),
    collection_name: 'SIMULASI KOLEKSI',
    source_slug: 'simulation-test',
    source_name: 'SIMULASI SUMBER',
    source_url: 'https://example.invalid/simulation',
    source_attribution: 'SIMULASI',
    license_name: 'SIMULASI',
    license_reference_url: 'https://example.invalid/license',
    hadith_number: 'SIMULASI-1a',
    numbering_scheme: 'SIMULASI-V1',
    book_name: 'SIMULASI ILMU',
    chapter_name: null,
    narrator: null,
    arabic_text: 'SIMULASI — PLACEHOLDER BUKAN TEKS ARAB',
    indonesian_text: 'SIMULASI — PLACEHOLDER BUKAN TERJEMAHAN',
    reference_url: 'https://example.invalid/record',
    translation_attribution: 'SIMULASI',
    grading_text: null,
    grading_attribution: null,
    grading_source_url: null,
    verification_reference_url: 'https://example.invalid/review',
  };
  db.query = async (sql) =>
    sql === LEXICAL_SQL
      ? [{ results: [row], total: 1 }]
      : sql.includes('DISTINCT')
        ? [{ slug: row.source_slug, displayName: row.source_name }]
        : [row];
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1`;
  assert.equal(
    (await (await fetch(`${base}/sources`)).json()).data[0].slug,
    'simulation-test',
  );
  const detail = await (await fetch(`${base}/hadiths/${row.id}`)).json();
  assert.deepEqual(detail.data, serializeHadith(row));
  assert.equal((await fetch(`${base}/hadiths/not-a-uuid`)).status, 400);
  const post = () =>
    fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'ilmu' }),
    });
  const result = await (await post()).json();
  assert.equal(result.meta.modeUsed, 'lexical');
  assert.equal(result.data.results[0].id, row.id);
  db.query = async () => [];
  assert.equal((await fetch(`${base}/hadiths/${row.id}`)).status, 404);
  const { ServiceUnavailableException } = require('@nestjs/common');
  db.query = async () => {
    throw new ServiceUnavailableException('DATABASE_UNAVAILABLE');
  };
  const failed = await post();
  assert.equal(failed.status, 503);
  const body = await failed.json();
  assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
  assert.equal(body.data, undefined);
  assert.equal(JSON.stringify(body).includes('simulation@'), false);
});
