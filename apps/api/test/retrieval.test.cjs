const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { createApp } = require('../dist/create-app');
const {
  RequestContextService,
} = require('../dist/common/request-context.service');
const {
  PostgresRetrievalGateway,
} = require('../dist/modules/retrieval/postgres-retrieval.gateway');
const {
  RetrievalGatewayError,
} = require('../dist/modules/retrieval/retrieval.gateway');
const {
  RetrievalToolError,
} = require('../dist/modules/retrieval/retrieval-tool.error');
const {
  RETRIEVAL_TOOL_ALLOWLIST,
  RetrievalToolExecutor,
} = require('../dist/modules/retrieval/retrieval-tool.executor');

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';

function record(overrides = {}) {
  return {
    id: firstId,
    title: 'Kitab simulasi kontrak',
    excerpt: 'Teks persis untuk fixture deterministik.',
    citation: {
      collection: 'Koleksi fixture',
      number: '1',
      numberingScheme: 'fixture-v1',
    },
    collection: 'Koleksi fixture',
    sourceSlug: 'fixture-source',
    hadithNumber: '1',
    numberingScheme: 'fixture-v1',
    bookName: 'Kitab fixture',
    chapterName: 'Bab fixture',
    narrator: 'Narator fixture',
    arabicText: 'نص اختبار صريح',
    translation: 'Teks persis untuk fixture deterministik.',
    indonesianText: 'Teks persis untuk fixture deterministik.',
    translationAttribution: 'Penerjemah fixture',
    grade: null,
    grader: null,
    gradingSourceUrl: null,
    sourceUrl: 'https://example.test/source',
    referenceUrl: 'https://example.test/reference/1',
    isVerified: true,
    verificationReferenceUrl: 'https://example.test/verification/1',
    topics: ['fixture'],
    provenance: {
      sourceName: 'Sumber fixture',
      attribution: 'Atribusi fixture',
      licenseName: 'Lisensi fixture',
      licenseUrl: 'https://example.test/license',
    },
    ...overrides,
  };
}

function researchRecord(overrides = {}) {
  return record({
    isVerified: false,
    isResearchOnly: true,
    verificationReferenceUrl: null,
    ...overrides,
  });
}

function environment(overrides = {}) {
  return {
    dataScope: 'published',
    retrievalTimeoutMs: 1000,
    retrievalMaxOutputBytes: 262144,
    ...overrides,
  };
}

function gateway(overrides = {}) {
  const records = [record()];
  return {
    search: async () => ({
      records,
      totalCandidates: records.length,
      modeUsed: 'lexical',
    }),
    findById: async (id) => records.find((item) => item.id === id),
    ...overrides,
  };
}

function expectCode(code) {
  return (error) => error instanceof RetrievalToolError && error.code === code;
}

test('allowlisted search emits exact evidence, deduplicates records and validates server-issued citations', async () => {
  const fixture = record();
  const executor = new RetrievalToolExecutor(
    gateway({
      search: async (input) => {
        assert.deepEqual(input, { query: 'ilmu', limit: 5 });
        return {
          records: [fixture, fixture],
          totalCandidates: 2,
          modeUsed: 'lexical_fallback',
          fallbackReason: 'UNAVAILABLE',
        };
      },
    }),
    environment(),
  );
  const session = executor.createSession();
  const searched = await session.execute('search_hadith', { query: 'ilmu' });
  assert.equal(searched.data.evidence.length, 1);
  assert.equal(
    searched.data.evidence[0].exactText.indonesian,
    fixture.indonesianText,
  );
  assert.equal(searched.data.evidence[0].status.publication, 'approved');
  assert.equal(searched.data.retrieval.countSemantics, 'exact');
  assert.equal(searched.data.retrieval.fallbackReason, 'UNAVAILABLE');
  const citationId = searched.data.evidence[0].citationId;
  const detailed = await session.execute('get_hadith_detail', {
    recordId: firstId,
  });
  assert.equal(detailed.data.evidence.recordId, firstId);
  assert.equal(detailed.data.evidence.citationId, citationId);
  const validated = await session.execute('validate_evidence_references', {
    citationIds: [citationId],
  });
  assert.equal(validated.data.valid, true);
  assert.equal(validated.data.evidence[0].recordId, firstId);
  assert.deepEqual(RETRIEVAL_TOOL_ALLOWLIST, [
    'search_hadith',
    'get_hadith_detail',
    'retrieve_related_evidence',
    'validate_evidence_references',
  ]);
});

test('invalid tool input and unregistered tool names fail closed', async () => {
  const session = new RetrievalToolExecutor(
    gateway(),
    environment(),
  ).createSession();
  await assert.rejects(
    () => session.execute('search_hadith', { query: 'x', sql: 'select *' }),
    expectCode('INVALID_INPUT'),
  );
  await assert.rejects(
    () => session.execute('execute_sql', { query: 'select *' }),
    expectCode('TOOL_NOT_ALLOWED'),
  );
});

test('empty search is explicit and missing detail or related seed is NOT_FOUND', async () => {
  const empty = gateway({
    search: async () => ({
      records: [],
      totalCandidates: 0,
      modeUsed: 'hybrid',
    }),
    findById: async () => undefined,
  });
  const session = new RetrievalToolExecutor(
    empty,
    environment(),
  ).createSession();
  const result = await session.execute('search_hadith', { query: 'tidak ada' });
  assert.deepEqual(result.data.evidence, []);
  assert.equal(result.data.retrieval.countSemantics, 'retrieval_window');
  await assert.rejects(
    () => session.execute('get_hadith_detail', { recordId: firstId }),
    expectCode('NOT_FOUND'),
  );
  await assert.rejects(
    () =>
      session.execute('retrieve_related_evidence', {
        recordId: firstId,
        query: 'topik terkait',
      }),
    expectCode('NOT_FOUND'),
  );
});

test('related evidence reuses search, excludes the seed and has bounded output', async () => {
  const seed = record();
  const related = record({
    id: secondId,
    hadithNumber: '2',
    citation: {
      collection: 'Koleksi fixture',
      number: '2',
      numberingScheme: 'fixture-v1',
    },
    referenceUrl: 'https://example.test/reference/2',
    verificationReferenceUrl: 'https://example.test/verification/2',
  });
  const session = new RetrievalToolExecutor(
    gateway({
      search: async () => ({
        records: [seed, related],
        totalCandidates: 2,
        modeUsed: 'hybrid',
      }),
      findById: async (id) => (id === firstId ? seed : related),
    }),
    environment(),
  ).createSession();
  const result = await session.execute('retrieve_related_evidence', {
    recordId: firstId,
    query: 'topik terkait',
  });
  assert.equal(result.data.seedRecordId, firstId);
  assert.deepEqual(
    result.data.evidence.map((item) => item.recordId),
    [secondId],
  );

  const oversized = new RetrievalToolExecutor(
    gateway({
      search: async () => ({
        records: [record({ indonesianText: 'x'.repeat(2000) })],
        totalCandidates: 1,
        modeUsed: 'lexical',
      }),
    }),
    environment({ retrievalMaxOutputBytes: 256 }),
  ).createSession();
  await assert.rejects(
    () => oversized.execute('search_hadith', { query: 'besar' }),
    expectCode('OUTPUT_TOO_LARGE'),
  );
});

test('duplicate and LLM-invented citation IDs are rejected', async () => {
  const session = new RetrievalToolExecutor(
    gateway(),
    environment(),
  ).createSession();
  const result = await session.execute('search_hadith', { query: 'ilmu' });
  const citationId = result.data.evidence[0].citationId;
  await assert.rejects(
    () =>
      session.execute('validate_evidence_references', {
        citationIds: [citationId, citationId],
      }),
    expectCode('DUPLICATE_EVIDENCE'),
  );
  await assert.rejects(
    () =>
      session.execute('validate_evidence_references', {
        citationIds: [`cite_${randomUUID()}`],
      }),
    expectCode('INVALID_CITATION'),
  );
});

test('changed or removed records invalidate citations independently of an LLM', async () => {
  let current = record();
  const session = new RetrievalToolExecutor(
    gateway({ findById: async () => current }),
    environment(),
  ).createSession();
  const result = await session.execute('search_hadith', { query: 'ilmu' });
  current = record({ indonesianText: 'Teks berubah setelah retrieval.' });
  await assert.rejects(
    () =>
      session.execute('validate_evidence_references', {
        citationIds: [result.data.evidence[0].citationId],
      }),
    expectCode('INVALID_CITATION'),
  );
});

test('research-only evidence is rejected in public policy and isolated in research policy', async () => {
  const research = researchRecord();
  const publicSession = new RetrievalToolExecutor(
    gateway({
      search: async () => ({
        records: [research],
        totalCandidates: 1,
        modeUsed: 'lexical',
      }),
      findById: async () => research,
    }),
    environment(),
  ).createSession();
  await assert.rejects(
    () => publicSession.execute('search_hadith', { query: 'riset' }),
    expectCode('RESEARCH_ONLY_REJECTED'),
  );

  const researchSession = new RetrievalToolExecutor(
    gateway({
      search: async () => ({
        records: [research],
        totalCandidates: 1,
        modeUsed: 'lexical',
      }),
    }),
    environment({ dataScope: 'local_pilot' }),
  ).createSession();
  const result = await researchSession.execute('search_hadith', {
    query: 'riset',
  });
  assert.equal(result.data.evidence[0].eligibility.policy, 'research');
  assert.equal(result.data.evidence[0].status.isResearchOnly, true);
});

test('provider unavailability, retrieval timeout and cancellation use normalized errors', async () => {
  const unavailable = new RetrievalToolExecutor(
    gateway({
      search: async () => {
        throw new RetrievalGatewayError('PROVIDER_UNAVAILABLE');
      },
    }),
    environment(),
  ).createSession();
  await assert.rejects(
    () => unavailable.execute('search_hadith', { query: 'provider' }),
    expectCode('PROVIDER_UNAVAILABLE'),
  );

  const waiting = gateway({
    search: async (_input, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        );
      }),
  });
  const timed = new RetrievalToolExecutor(
    waiting,
    environment({ retrievalTimeoutMs: 20 }),
  ).createSession();
  await assert.rejects(
    () => timed.execute('search_hadith', { query: 'timeout' }),
    expectCode('TIMEOUT'),
  );

  const controller = new AbortController();
  controller.abort();
  const cancelled = new RetrievalToolExecutor(
    waiting,
    environment(),
  ).createSession({
    signal: controller.signal,
  });
  await assert.rejects(
    () => cancelled.execute('search_hadith', { query: 'cancel' }),
    expectCode('ABORTED'),
  );
});

test('Postgres adapter delegates to existing search service and excludes mock placeholders', async () => {
  let searchOptions;
  const searchService = {
    search: async (_input, options) => {
      searchOptions = options;
      return {
        data: {
          results: [
            record(),
            {
              id: 'mock-a',
              hadithNumber: null,
            },
          ],
          totalCandidates: 2,
        },
        meta: { modeUsed: 'hybrid' },
      };
    },
  };
  const repository = { find: async () => undefined };
  const adapter = new PostgresRetrievalGateway(searchService, repository, {
    mode: 'hybrid',
  });
  const controller = new AbortController();
  const page = await adapter.search(
    { query: 'ilmu', limit: 5 },
    { signal: controller.signal },
  );
  assert.equal(page.records.length, 1);
  assert.equal(page.records[0].id, firstId);
  assert.equal(searchOptions.signal, controller.signal);
});

test('request correlation is captured once per session and module adds no public endpoint', async (t) => {
  const requestContext = new RequestContextService();
  const correlationId = randomUUID();
  const executor = new RetrievalToolExecutor(
    gateway(),
    environment(),
    requestContext,
  );
  const session = requestContext.run(correlationId, () =>
    executor.createSession(),
  );
  const result = await session.execute('search_hadith', { query: 'ilmu' });
  assert.equal(result.requestId, correlationId);

  const app = await createApp(false);
  t.after(() => app.close());
  assert.ok(app.get(RetrievalToolExecutor));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  assert.equal((await fetch(`${base}/api/v2/retrieval`)).status, 404);
  const v1 = await fetch(`${base}/api/v1/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'menuntut ilmu', limit: 1 }),
  });
  assert.equal(v1.status, 200);
  assert.equal((await v1.json()).meta.modeUsed, 'mock');
});
