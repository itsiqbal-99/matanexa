const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const {
  conversationContextSchema,
  conversationStreamEventSchema,
  conversationTurnRequestSchema,
  conversationTurnResultSchema,
  errorEnvelopeSchema,
  normalizeQuery,
  searchRequestSchema,
  searchResponseSchema,
  evidenceSchema,
  getHadithDetailToolInputSchema,
  retrievalToolInputSchemas,
  retrievalToolNames,
  searchHadithToolInputSchema,
} = require('../dist');

test('v1 search contract normalizes and serializes without changing shape', () => {
  const parsed = searchRequestSchema.parse({
    query: '  ＩＬＭＵ\n BELAJAR ',
    limit: 5,
  });
  assert.equal(normalizeQuery(parsed.query), 'ilmu belajar');
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), {
    query: '  ＩＬＭＵ\n BELAJAR ',
    page: 1,
    limit: 5,
  });
});

test('v1 response contract round-trips the existing mock HTTP shape', () => {
  const response = {
    data: {
      query: 'menuntut ilmu',
      results: [
        {
          id: 'mock-knowledge-1',
          title: 'Menuntut ilmu',
          excerpt: 'Data simulasi, bukan kutipan hadits.',
          citation: {
            collection: 'Koleksi simulasi A',
            number: 'MOCK',
            numberingScheme: 'mock',
          },
          collection: 'Koleksi simulasi A',
          sourceSlug: 'mock-a',
          hadithNumber: null,
          arabicText: null,
          translation: null,
          grade: null,
          sourceUrl: null,
          referenceUrl: null,
          isVerified: false,
        },
      ],
      totalCandidates: 1,
    },
    meta: {
      page: 1,
      limit: 10,
      hasMore: false,
      modeUsed: 'mock',
      requestId: randomUUID(),
    },
  };
  assert.deepEqual(searchResponseSchema.parse(response), response);
});

test('v2 conversation context round-trips only model-independent client fields', () => {
  const input = {
    version: 2,
    conversationId: randomUUID(),
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: 'Apa makna hasil ini?',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  assert.deepEqual(conversationContextSchema.parse(input), input);
});

test('v2 conversation rejects privileged roles and provider-owned metadata', () => {
  const base = {
    version: 2,
    conversationId: randomUUID(),
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: 'Pertanyaan aman',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  assert.equal(
    conversationContextSchema.safeParse({
      ...base,
      messages: [{ ...base.messages[0], role: 'system' }],
    }).success,
    false,
  );
  assert.equal(
    conversationContextSchema.safeParse({
      ...base,
      messages: [{ ...base.messages[0], role: 'tool' }],
    }).success,
    false,
  );
  assert.equal(
    conversationContextSchema.safeParse({ ...base, provider: 'vendor-a' })
      .success,
    false,
  );
  assert.equal(
    conversationContextSchema.safeParse({
      ...base,
      messages: [{ ...base.messages[0], providerPayload: { tokenCount: 3 } }],
    }).success,
    false,
  );
  assert.equal(
    conversationContextSchema.safeParse({
      ...base,
      messages: [{ ...base.messages[0], evidenceRecordIds: [randomUUID()] }],
    }).success,
    false,
  );
});

test('v2 conversation permits stable evidence identities only on assistant history', () => {
  const recordId = randomUUID();
  const context = {
    version: 2,
    conversationId: randomUUID(),
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: 'Hadits tentang orang tua',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'message-2',
        role: 'assistant',
        content: 'Evidence sebelumnya.',
        createdAt: new Date().toISOString(),
        evidenceRecordIds: [recordId],
      },
      {
        id: 'message-3',
        role: 'user',
        content: 'Kalau khusus ibu?',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  assert.deepEqual(conversationContextSchema.parse(context), context);
  assert.equal(
    conversationContextSchema.safeParse({
      ...context,
      messages: [...context.messages, context.messages[0]],
    }).success,
    false,
  );
  assert.equal(typeof conversationTurnResultSchema.safeParse, 'function');
});

test('v2 internal turn and SSE contracts reject privileged input and raw events', () => {
  const context = {
    version: 2,
    conversationId: randomUUID(),
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: 'Hadits tentang amanah',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  assert.deepEqual(conversationTurnRequestSchema.parse({ context }), {
    context,
  });
  assert.equal(
    conversationTurnRequestSchema.safeParse({ context, provider: 'vendor' })
      .success,
    false,
  );
  const started = {
    version: 2,
    requestId: randomUUID(),
    sequence: 1,
    emittedAt: new Date().toISOString(),
    event: 'message_started',
    data: {
      conversationId: context.conversationId,
      delivery: 'buffered_validated',
    },
  };
  assert.deepEqual(conversationStreamEventSchema.parse(started), started);
  assert.equal(
    conversationStreamEventSchema.safeParse({
      ...started,
      rawProviderEvent: { token: 'secret' },
    }).success,
    false,
  );
  assert.equal(
    conversationStreamEventSchema.safeParse({
      ...started,
      event: 'text_delta',
      data: {
        messageId: 'message-2',
        text: 'belum tervalidasi',
        source: 'provider_raw',
      },
    }).success,
    false,
  );
});

test('public error envelope requires a stable code and correlation ID', () => {
  assert.equal(
    errorEnvelopeSchema.safeParse({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Permintaan tidak valid.',
        requestId: randomUUID(),
      },
    }).success,
    true,
  );
  assert.equal(
    errorEnvelopeSchema.safeParse({
      error: { code: 'VENDOR_ERROR', message: 'raw', requestId: 'not-a-uuid' },
    }).success,
    false,
  );
});

test('v2 retrieval tool inputs are allowlisted, strict and bounded', () => {
  assert.deepEqual(retrievalToolNames, [
    'search_hadith',
    'get_hadith_detail',
    'retrieve_related_evidence',
    'validate_evidence_references',
  ]);
  assert.deepEqual(searchHadithToolInputSchema.parse({ query: '  ilmu  ' }), {
    query: 'ilmu',
    limit: 5,
  });
  assert.equal(
    searchHadithToolInputSchema.safeParse({ query: 'ilmu', limit: 11 }).success,
    false,
  );
  assert.equal(
    searchHadithToolInputSchema.safeParse({ query: 'ilmu', sql: 'select 1' })
      .success,
    false,
  );
  assert.equal(
    getHadithDetailToolInputSchema.safeParse({ recordId: 'not-a-uuid' })
      .success,
    false,
  );
  assert.equal(Object.keys(retrievalToolInputSchemas).length, 4);
});

test('evidence contract requires exact text, provenance and eligibility status', () => {
  const evidence = {
    citationId: `cite_${randomUUID()}`,
    recordId: randomUUID(),
    exactText: { arabic: 'نص', indonesian: 'Teks persis' },
    reference: {
      collection: 'Koleksi',
      hadithNumber: '1',
      numberingScheme: 'source',
      bookName: 'Kitab',
      chapterName: null,
      narrator: null,
      referenceUrl: 'https://example.test/reference',
      verificationReferenceUrl: 'https://example.test/verification',
    },
    source: {
      slug: 'source-a',
      name: 'Source A',
      sourceUrl: 'https://example.test/source',
    },
    provenance: {
      attribution: 'Attribution',
      translationAttribution: 'Translator',
      licenseName: 'License',
      licenseUrl: 'https://example.test/license',
    },
    status: {
      verification: 'verified',
      publication: 'approved',
      isResearchOnly: false,
    },
    eligibility: {
      policy: 'public',
      eligible: true,
      reasons: ['VERIFIED', 'APPROVED_SOURCE'],
    },
  };
  assert.deepEqual(evidenceSchema.parse(evidence), evidence);
  assert.equal(
    evidenceSchema.safeParse({
      ...evidence,
      exactText: { indonesian: 'missing' },
    }).success,
    false,
  );
});
