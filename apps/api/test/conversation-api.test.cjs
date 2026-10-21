const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { conversationStreamEventSchema } = require('@matanexa/contracts');
const { ApiExceptionFilter } = require('../dist/common/api-exception.filter');
const {
  RequestContextService,
} = require('../dist/common/request-context.service');
const { ENVIRONMENT, readEnvironment } = require('../dist/config/environment');
const { createApp } = require('../dist/create-app');
const {
  ConversationApiError,
} = require('../dist/modules/conversations/conversation-api.error');
const {
  ConversationApiService,
} = require('../dist/modules/conversations/conversation-api.service');
const {
  ConversationController,
} = require('../dist/modules/conversations/conversation.controller');
const {
  ConversationOrchestratorService,
} = require('../dist/modules/conversations/conversation-orchestrator.service');
const {
  ConversationTelemetryCollector,
} = require('../dist/modules/conversations/conversation-telemetry');
const {
  InternalConversationGuard,
  INTERNAL_CONVERSATION_KEY_HEADER,
} = require('../dist/modules/conversations/internal-conversation.guard');
const {
  RetrievalToolExecutor,
} = require('../dist/modules/retrieval/retrieval-tool.executor');
const {
  DisabledLlmProvider,
} = require('../dist/providers/llm/disabled-llm.provider');

const accessKey = 'test-internal-key-0123456789-abcdef';
const recordId = '11111111-1111-4111-8111-111111111111';
const modelId = 'mock-conversation-v1';

function environment(overrides = {}) {
  return {
    ...readEnvironment({ NODE_ENV: 'test' }),
    runtimeEnvironment: 'test',
    internalConversationApiEnabled: true,
    internalConversationApiKey: accessKey,
    llmProvider: 'cloudflare',
    llmModel: modelId,
    llmTimeoutMs: 1000,
    retrievalTimeoutMs: 1000,
    ...overrides,
  };
}

function context(
  messages = [{ role: 'user', content: 'Hadits tentang amanah' }],
) {
  const now = new Date().toISOString();
  return {
    version: 2,
    conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    messages: messages.map((message, index) => ({
      id: `message-${index + 1}`,
      createdAt: now,
      ...message,
    })),
  };
}

function record(overrides = {}) {
  return {
    id: recordId,
    title: 'Kitab fixture',
    excerpt: 'Terjemahan fixture yang persis.',
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
    translation: 'Terjemahan fixture yang persis.',
    indonesianText: 'Terjemahan fixture yang persis.',
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

class ScriptedProvider {
  providerId = 'mock-conversation';
  requests = [];

  constructor(responses) {
    this.responses = [...responses];
  }

  capabilities(requestedModelId) {
    return {
      providerId: this.providerId,
      modelId: requestedModelId,
      contextWindow: 4096,
      maxOutputTokens: 512,
      streaming: 'none',
      toolCalling: 'none',
      structuredOutput: 'json_object',
      usage: ['input_tokens', 'output_tokens', 'total_tokens'],
      timeoutMs: 1000,
      maxConcurrency: 1,
      evidence: {
        source: 'deterministic-test-double',
        checkedAt: '2026-10-21',
      },
    };
  }

  async generate(request, options = {}) {
    this.requests.push(request);
    if (options.signal?.aborted)
      throw Object.assign(new Error('ABORTED'), { code: 'ABORTED' });
    const response = this.responses.shift();
    if (typeof response === 'function') return response(request, options);
    return {
      providerId: this.providerId,
      modelId,
      finishReason: 'stop',
      usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
      ...response,
    };
  }

  stream() {
    throw new Error('not used');
  }
}

function groundedResponse(request) {
  const evidenceMessage = request.messages.find(
    (message) =>
      message.role === 'system' &&
      message.content.startsWith('VALIDATED_EVIDENCE_JSON:'),
  );
  const [evidence] = JSON.parse(
    evidenceMessage.content.slice('VALIDATED_EVIDENCE_JSON:'.length),
  );
  return {
    providerId: 'mock-conversation',
    modelId,
    text: JSON.stringify({
      answer: 'Jawaban fixture yang sudah tervalidasi.',
      citationIds: [evidence.citationId],
    }),
    finishReason: 'stop',
    usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
  };
}

function resultFixture(overrides = {}) {
  return {
    version: 2,
    conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    assistant: {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Jawaban fixture yang sudah tervalidasi.',
      createdAt: new Date().toISOString(),
      evidenceRecordIds: [],
    },
    evidence: [],
    execution: {
      requestId: randomUUID(),
      status: 'no_evidence',
      planningStrategy: 'latest_user',
      selectedMessageCount: 1,
      omittedMessageCount: 0,
      toolExecutions: 1,
      staleEvidenceCount: 0,
      durationMs: 1,
    },
    provider: {
      providerId: 'mock-conversation',
      modelId,
      generationCalls: 0,
      durationMs: 0,
    },
    ...overrides,
  };
}

async function createInternalApp({
  env = environment(),
  provider = new ScriptedProvider([groundedResponse]),
  gatewayDouble = gateway(),
  orchestrator,
} = {}) {
  const requestContext = new RequestContextService();
  const actualOrchestrator =
    orchestrator ??
    new ConversationOrchestratorService(
      provider,
      new RetrievalToolExecutor(gatewayDouble, env, requestContext),
      env,
      new ConversationTelemetryCollector(),
    );
  class InternalTestModule {}
  Module({
    controllers: [ConversationController],
    providers: [
      { provide: ENVIRONMENT, useValue: env },
      { provide: RequestContextService, useValue: requestContext },
      {
        provide: ConversationOrchestratorService,
        useValue: actualOrchestrator,
      },
      ConversationApiService,
      InternalConversationGuard,
    ],
  })(InternalTestModule);
  const app = await NestFactory.create(InternalTestModule, { logger: false });
  app.use((_request, response, next) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-ID', requestId);
    requestContext.run(requestId, next);
  });
  app.useGlobalFilters(new ApiExceptionFilter(requestContext));
  await app.listen(0, '127.0.0.1');
  return { app, base: await app.getUrl(), provider };
}

function requestOptions(body, key = accessKey, signal) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_CONVERSATION_KEY_HEADER]: key,
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  };
}

function parseEvents(text) {
  return text
    .trim()
    .split('\n\n')
    .map((block) => {
      const data = block.split('\n').find((line) => line.startsWith('data: '));
      return conversationStreamEventSchema.parse(
        JSON.parse(data.slice('data: '.length)),
      );
    });
}

test('internal JSON API executes a grounded mock turn and propagates multi-turn context', async (t) => {
  let searchQuery;
  const provider = new ScriptedProvider([
    { text: 'hadits singkat tentang ibu' },
    groundedResponse,
  ]);
  const fixture = await createInternalApp({
    provider,
    gatewayDouble: gateway({
      search: async (input) => {
        searchQuery = input.query;
        return { records: [record()], totalCandidates: 1, modeUsed: 'lexical' };
      },
    }),
  });
  t.after(() => fixture.app.close());
  const conversation = context([
    { role: 'user', content: 'Hadits tentang orang tua' },
    { role: 'assistant', content: 'Evidence sebelumnya.' },
    { role: 'user', content: 'Yang singkat khusus ibu?' },
  ]);
  const response = await fetch(
    `${fixture.base}/api/v2/internal/conversations/turn`,
    requestOptions({ context: conversation }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.execution.status, 'grounded');
  assert.equal(
    body.assistant.content,
    'Jawaban fixture yang sudah tervalidasi.',
  );
  assert.equal(searchQuery, 'hadits singkat tentang ibu');
  assert.deepEqual(
    provider.requests[0].messages.slice(1).map((message) => message.content),
    [
      'Hadits tentang orang tua',
      'Evidence sebelumnya.',
      'Yang singkat khusus ibu?',
    ],
  );
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('internal API rejects disabled, unauthorized, and invalid requests', async (t) => {
  const actual = await createApp(false);
  t.after(() => actual.close());
  await actual.listen(0, '127.0.0.1');
  const actualBase = await actual.getUrl();
  const disabled = await fetch(
    `${actualBase}/api/v2/internal/conversations/turn`,
    requestOptions({ context: context() }),
  );
  assert.equal(disabled.status, 404);
  assert.equal((await disabled.json()).error.code, 'NOT_FOUND');

  const fixture = await createInternalApp();
  t.after(() => fixture.app.close());
  const unauthorized = await fetch(
    `${fixture.base}/api/v2/internal/conversations/turn`,
    requestOptions({ context: context() }, 'wrong-key'),
  );
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).error.code, 'UNAUTHORIZED');
  const invalid = await fetch(
    `${fixture.base}/api/v2/internal/conversations/turn`,
    requestOptions({
      context: context(),
      evidence: [{ citationId: `cite_${randomUUID()}` }],
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'VALIDATION_ERROR');
});

test('real application exposes the isolated v2 route only after explicit activation', async (t) => {
  const keys = [
    'NODE_ENV',
    'INTERNAL_CONVERSATION_API_ENABLED',
    'INTERNAL_CONVERSATION_API_KEY',
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.NODE_ENV = 'test';
  process.env.INTERNAL_CONVERSATION_API_ENABLED = 'true';
  process.env.INTERNAL_CONVERSATION_API_KEY = accessKey;
  let app;
  try {
    app = await createApp(false);
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const response = await fetch(
    `${base}/api/v2/internal/conversations/turn`,
    requestOptions({ context: context() }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.execution.status, 'no_evidence');
  assert.equal(response.headers.get('x-request-id'), body.execution.requestId);
  assert.equal(
    (await fetch(`${base}/api/v1/api/v2/internal/conversations/turn`)).status,
    404,
  );
});

test('evidence-only and no-evidence results remain explicit through JSON API', async (t) => {
  const disabledFixture = await createInternalApp({
    env: environment({ llmProvider: 'disabled', llmModel: undefined }),
    provider: new DisabledLlmProvider(),
  });
  t.after(() => disabledFixture.app.close());
  const evidenceOnly = await fetch(
    `${disabledFixture.base}/api/v2/internal/conversations/turn`,
    requestOptions({ context: context() }),
  );
  assert.equal((await evidenceOnly.json()).execution.status, 'evidence_only');

  const emptyFixture = await createInternalApp({
    gatewayDouble: gateway({
      search: async () => ({
        records: [],
        totalCandidates: 0,
        modeUsed: 'lexical',
      }),
    }),
  });
  t.after(() => emptyFixture.app.close());
  const noEvidence = await fetch(
    `${emptyFixture.base}/api/v2/internal/conversations/turn`,
    requestOptions({ context: context() }),
  );
  assert.equal((await noEvidence.json()).execution.status, 'no_evidence');
});

test('SSE ordering is stable and content is emitted only after validation', async (t) => {
  const fixture = await createInternalApp();
  t.after(() => fixture.app.close());
  const response = await fetch(
    `${fixture.base}/api/v2/internal/conversations/turn/stream`,
    requestOptions({ context: context() }),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/event-stream/);
  const events = parseEvents(await response.text());
  assert.deepEqual(
    events.map((event) => event.event),
    [
      'message_started',
      'status_changed',
      'status_changed',
      'reference_added',
      'text_delta',
      'message_completed',
    ],
  );
  assert.deepEqual(
    events.map((event) => event.sequence),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(events[2].data.status, 'validated');
  assert.equal(events[4].data.source, 'buffered_validated');
  assert.equal(events[5].data.result.execution.status, 'grounded');
  assert.equal(events[0].requestId, events[5].data.result.execution.requestId);
  assert.equal(
    events.filter((event) =>
      ['message_completed', 'error'].includes(event.event),
    ).length,
    1,
  );
});

test('SSE timeout and output bounds end with one safe error event', async (t) => {
  const waiting = {
    execute: (_context, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          'abort',
          () => reject(new Error('aborted internally')),
          { once: true },
        );
      }),
  };
  const timedFixture = await createInternalApp({
    env: environment({ conversationApiTimeoutMs: 25 }),
    orchestrator: waiting,
  });
  t.after(() => timedFixture.app.close());
  const timed = await fetch(
    `${timedFixture.base}/api/v2/internal/conversations/turn/stream`,
    requestOptions({ context: context() }),
  );
  const timedEvents = parseEvents(await timed.text());
  assert.equal(timedEvents.at(-1).event, 'error');
  assert.equal(timedEvents.at(-1).data.code, 'TIMEOUT');
  assert.equal(
    timedEvents.filter((event) =>
      ['message_completed', 'error'].includes(event.event),
    ).length,
    1,
  );

  const oversized = resultFixture({
    assistant: {
      id: 'assistant-large',
      role: 'assistant',
      content: 'x'.repeat(4000),
      createdAt: new Date().toISOString(),
      evidenceRecordIds: [],
    },
  });
  const outputFixture = await createInternalApp({
    env: environment({ conversationSseMaxOutputBytes: 4096 }),
    orchestrator: { execute: async () => oversized },
  });
  t.after(() => outputFixture.app.close());
  const output = await fetch(
    `${outputFixture.base}/api/v2/internal/conversations/turn/stream`,
    requestOptions({ context: context() }),
  );
  const outputEvents = parseEvents(await output.text());
  assert.equal(outputEvents.at(-1).event, 'error');
  assert.equal(outputEvents.at(-1).data.code, 'OUTPUT_TOO_LARGE');
  assert.ok(!outputEvents.some((event) => event.event === 'text_delta'));
  assert.ok(!outputEvents.some((event) => event.event === 'message_completed'));
});

test('client disconnect aborts orchestration and concurrency is fail-closed', async (t) => {
  let observeAbort;
  const abortObserved = new Promise((resolve) => {
    observeAbort = resolve;
  });
  const waiting = {
    execute: (_context, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          'abort',
          () => {
            observeAbort();
            reject(new Error('client disconnected'));
          },
          { once: true },
        );
      }),
  };
  const fixture = await createInternalApp({ orchestrator: waiting });
  t.after(() => fixture.app.close());
  const controller = new AbortController();
  const response = await fetch(
    `${fixture.base}/api/v2/internal/conversations/turn/stream`,
    requestOptions({ context: context() }, accessKey, controller.signal),
  );
  assert.equal(response.status, 200);
  controller.abort();
  await assert.rejects(() => response.text());
  await abortObserved;

  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const service = new ConversationApiService(
    { execute: () => held },
    environment({ conversationApiMaxConcurrency: 1 }),
  );
  const first = service.execute(context());
  await assert.rejects(
    () => service.execute(context()),
    (error) =>
      error instanceof ConversationApiError &&
      error.code === 'CONCURRENCY_LIMIT',
  );
  release(resultFixture());
  await first;
});

test('API v1 remains compatible while v2 uses an isolated path', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const v1 = await fetch(`${base}/api/v1/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'menuntut ilmu', limit: 1 }),
  });
  assert.equal(v1.status, 200);
  assert.equal((await v1.json()).meta.modeUsed, 'mock');
  assert.equal(
    (
      await fetch(`${base}/api/v1/api/v2/internal/conversations/turn`, {
        method: 'POST',
      })
    ).status,
    404,
  );
});
