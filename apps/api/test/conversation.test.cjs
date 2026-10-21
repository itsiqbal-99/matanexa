const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { createApp } = require('../dist/create-app');
const {
  ConversationOrchestrationError,
} = require('../dist/modules/conversations/conversation.error');
const {
  ConversationOrchestratorService,
} = require('../dist/modules/conversations/conversation-orchestrator.service');
const {
  selectConversationContext,
} = require('../dist/modules/conversations/context-window');
const {
  ConversationTelemetryCollector,
} = require('../dist/modules/conversations/conversation-telemetry');
const {
  RetrievalToolExecutor,
} = require('../dist/modules/retrieval/retrieval-tool.executor');
const {
  DisabledLlmProvider,
} = require('../dist/providers/llm/disabled-llm.provider');

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const modelId = 'mock-conversation-v1';

function record(overrides = {}) {
  return {
    id: firstId,
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

function researchRecord() {
  return record({
    isVerified: false,
    isResearchOnly: true,
    verificationReferenceUrl: null,
  });
}

function environment(overrides = {}) {
  return {
    dataScope: 'published',
    llmProvider: 'cloudflare',
    llmModel: modelId,
    llmTimeoutMs: 1000,
    retrievalTimeoutMs: 1000,
    retrievalMaxOutputBytes: 262144,
    orchestrationMaxContextChars: 16000,
    orchestrationMaxOutputBytes: 65536,
    orchestrationMaxToolExecutions: 4,
    orchestrationMaxOutputTokens: 512,
    ...overrides,
  };
}

function context(messages) {
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

  constructor(responses, capabilityOverrides = {}) {
    this.responses = [...responses];
    this.capabilityOverrides = capabilityOverrides;
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
      ...this.capabilityOverrides,
    };
  }

  async generate(request, options = {}) {
    this.requests.push(request);
    if (options.signal?.aborted)
      throw Object.assign(new Error('ABORTED'), { code: 'ABORTED' });
    const response = this.responses.shift();
    if (typeof response === 'function') return response(request, options);
    if (!response) throw new Error('No scripted response');
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

function groundedResponse(request, recordId = firstId) {
  const evidenceMessage = request.messages.find(
    (message) =>
      message.role === 'system' &&
      message.content.startsWith('VALIDATED_EVIDENCE_JSON:'),
  );
  const evidence = JSON.parse(
    evidenceMessage.content.slice('VALIDATED_EVIDENCE_JSON:'.length),
  );
  const selected =
    evidence.find((item) => item.recordId === recordId) ?? evidence[0];
  return {
    providerId: 'mock-conversation',
    modelId,
    text: JSON.stringify({
      answer: 'Penjelasan ringkas berdasarkan evidence yang tervalidasi.',
      citationIds: [selected.citationId],
    }),
    finishReason: 'stop',
    usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
  };
}

function harness(provider, gatewayDouble = gateway(), env = environment()) {
  const telemetry = new ConversationTelemetryCollector();
  const retrieval = new RetrievalToolExecutor(gatewayDouble, env);
  return {
    telemetry,
    orchestrator: new ConversationOrchestratorService(
      provider,
      retrieval,
      env,
      telemetry,
    ),
  };
}

test('single-turn answer is grounded and every citation is server-validated', async () => {
  let searched;
  const provider = new ScriptedProvider([groundedResponse]);
  const { orchestrator, telemetry } = harness(
    provider,
    gateway({
      search: async (input) => {
        searched = input.query;
        return { records: [record()], totalCandidates: 1, modeUsed: 'hybrid' };
      },
    }),
  );
  const result = await orchestrator.execute(
    context([{ role: 'user', content: 'Hadits tentang menjaga lisan' }]),
  );
  assert.equal(searched, 'Hadits tentang menjaga lisan');
  assert.equal(result.execution.status, 'grounded');
  assert.equal(result.evidence[0].recordId, firstId);
  assert.deepEqual(result.assistant.evidenceRecordIds, [firstId]);
  assert.equal(result.execution.toolExecutions, 2);
  assert.equal(provider.requests.length, 1);
  const telemetryText = JSON.stringify(telemetry.snapshot());
  assert.equal(telemetry.snapshot().length, 1);
  assert.ok(!telemetryText.includes('menjaga lisan'));
  assert.ok(!telemetryText.includes('نص اختبار'));
});

test('multi-turn history drives LLM reformulation without hardcoded intent rules', async () => {
  let searchQuery;
  const second = record({
    id: secondId,
    hadithNumber: '2',
    referenceUrl: 'https://example.test/reference/2',
    verificationReferenceUrl: 'https://example.test/verification/2',
  });
  const provider = new ScriptedProvider([
    { text: 'hadits singkat tentang berbakti kepada ibu' },
    (request) => groundedResponse(request, secondId),
  ]);
  const { orchestrator } = harness(
    provider,
    gateway({
      search: async (input) => {
        searchQuery = input.query;
        return { records: [second], totalCandidates: 1, modeUsed: 'lexical' };
      },
      findById: async (id) => (id === firstId ? record() : second),
    }),
  );
  const result = await orchestrator.execute(
    context([
      {
        role: 'user',
        content: 'Woi minta hadits tentang berbakti ke orang tua dong',
      },
      {
        role: 'assistant',
        content: 'Evidence sebelumnya.',
        evidenceRecordIds: [firstId],
      },
      { role: 'user', content: 'Kalau khusus ibu?' },
      { role: 'assistant', content: 'Evidence khusus ibu.' },
      { role: 'user', content: 'Yang pendek buat status WA' },
    ]),
  );
  assert.equal(searchQuery, 'hadits singkat tentang berbakti kepada ibu');
  assert.equal(result.execution.planningStrategy, 'llm_reformulation');
  assert.equal(result.execution.status, 'grounded');
  assert.equal(result.evidence[0].recordId, secondId);
  assert.deepEqual(
    provider.requests[0].messages.slice(1).map((message) => message.content),
    [
      'Woi minta hadits tentang berbakti ke orang tua dong',
      'Evidence sebelumnya.',
      'Kalau khusus ibu?',
      'Evidence khusus ibu.',
      'Yang pendek buat status WA',
    ],
  );
});

test('topic switching is delegated to the model-supplied retrieval query', async () => {
  let searchQuery;
  const provider = new ScriptedProvider([
    { text: 'hadits menjaga lisan' },
    groundedResponse,
  ]);
  const { orchestrator } = harness(
    provider,
    gateway({
      search: async (input) => {
        searchQuery = input.query;
        return { records: [record()], totalCandidates: 1, modeUsed: 'lexical' };
      },
    }),
  );
  const result = await orchestrator.execute(
    context([
      { role: 'user', content: 'Hadits tentang orang tua' },
      { role: 'assistant', content: 'Evidence sebelumnya.' },
      { role: 'user', content: 'Ganti topik ke menjaga lisan' },
    ]),
  );
  assert.equal(searchQuery, 'hadits menjaga lisan');
  assert.equal(result.execution.status, 'grounded');
});

test('empty retrieval is explicit and does not call generation', async () => {
  const provider = new ScriptedProvider([groundedResponse]);
  const { orchestrator } = harness(
    provider,
    gateway({
      search: async () => ({
        records: [],
        totalCandidates: 0,
        modeUsed: 'lexical',
      }),
    }),
  );
  const result = await orchestrator.execute(
    context([{ role: 'user', content: 'Tidak ada hasil' }]),
  );
  assert.equal(result.execution.status, 'no_evidence');
  assert.equal(result.evidence.length, 0);
  assert.equal(provider.requests.length, 0);
});

test('invented and stale citations fail closed', async () => {
  const provider = new ScriptedProvider([
    {
      text: JSON.stringify({
        answer: 'Penjelasan tanpa sumber sah.',
        citationIds: [`cite_${randomUUID()}`],
      }),
    },
  ]);
  const { orchestrator } = harness(provider);
  const invalid = await orchestrator.execute(
    context([{ role: 'user', content: 'Hadits tentang ilmu' }]),
  );
  assert.equal(invalid.execution.status, 'evidence_only');
  assert.equal(invalid.execution.fallbackReason, 'INVALID_CITATION');

  const validProvider = new ScriptedProvider([
    { text: 'hadits ilmu lanjutan' },
    groundedResponse,
  ]);
  const { orchestrator: staleOrchestrator } = harness(
    validProvider,
    gateway({
      findById: async (id) => (id === secondId ? undefined : record()),
    }),
  );
  const stale = await staleOrchestrator.execute(
    context([
      { role: 'user', content: 'Hadits ilmu' },
      {
        role: 'assistant',
        content: 'Evidence lama.',
        evidenceRecordIds: [secondId],
      },
      { role: 'user', content: 'Lanjutkan' },
    ]),
  );
  assert.equal(stale.execution.staleEvidenceCount, 1);
});

test('research-only evidence cannot become a public answer', async () => {
  const provider = new ScriptedProvider([groundedResponse]);
  const { orchestrator } = harness(
    provider,
    gateway({
      search: async () => ({
        records: [researchRecord()],
        totalCandidates: 1,
        modeUsed: 'lexical',
      }),
      findById: async () => researchRecord(),
    }),
  );
  await assert.rejects(
    () =>
      orchestrator.execute(
        context([{ role: 'user', content: 'Evidence riset' }]),
      ),
    (error) =>
      error instanceof ConversationOrchestrationError &&
      error.code === 'RETRIEVAL_FAILED',
  );
});

test('provider timeout and disabled provider return evidence-only safely', async () => {
  const waitingProvider = new ScriptedProvider(
    [
      (_request, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () =>
              reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })),
            { once: true },
          );
        }),
    ],
    { timeoutMs: 20 },
  );
  const timed = await harness(
    waitingProvider,
    gateway(),
    environment({ llmTimeoutMs: 20 }),
  ).orchestrator.execute(
    context([{ role: 'user', content: 'Hadits tentang waktu' }]),
  );
  assert.equal(timed.execution.status, 'evidence_only');
  assert.equal(timed.execution.fallbackReason, 'PROVIDER_TIMEOUT');

  const disabledEnv = environment({
    llmProvider: 'disabled',
    llmModel: undefined,
  });
  const disabled = await harness(
    new DisabledLlmProvider(),
    gateway(),
    disabledEnv,
  ).orchestrator.execute(
    context([{ role: 'user', content: 'Hadits tentang ilmu' }]),
  );
  assert.equal(disabled.execution.status, 'evidence_only');
  assert.equal(disabled.provider.providerId, 'disabled');
  assert.equal(disabled.provider.generationCalls, 0);
});

test('providers without native tools use deterministic retrieval-first requests', async () => {
  const provider = new ScriptedProvider(
    [{ text: 'hadits ibu' }, groundedResponse],
    { toolCalling: 'none', structuredOutput: 'none' },
  );
  const { orchestrator } = harness(provider);
  const result = await orchestrator.execute(
    context([
      { role: 'user', content: 'Hadits orang tua' },
      { role: 'assistant', content: 'Evidence.' },
      { role: 'user', content: 'Khusus ibu' },
    ]),
  );
  assert.equal(result.execution.status, 'grounded');
  assert.ok(provider.requests.every((request) => request.tools === undefined));
  assert.ok(
    provider.requests.every((request) => request.responseFormat === undefined),
  );
  assert.ok(
    provider.requests.every((request) =>
      request.messages.every((message) => message.role !== 'tool'),
    ),
  );
});

test('native tool plans remain allowlisted and bounded', async () => {
  const provider = new ScriptedProvider(
    [
      {
        text: '',
        finishReason: 'tool_call',
        toolCalls: [
          {
            id: 'call-1',
            name: 'search_hadith',
            arguments: { query: 'hadits aman', limit: 5 },
          },
          {
            id: 'call-2',
            name: 'execute_sql',
            arguments: { sql: 'select *' },
          },
        ],
      },
      groundedResponse,
    ],
    { toolCalling: 'native' },
  );
  const { orchestrator } = harness(provider);
  const result = await orchestrator.execute(
    context([{ role: 'user', content: 'Hadits aman' }]),
  );
  assert.equal(result.execution.planningStrategy, 'native_tool');
  assert.equal(result.execution.status, 'grounded');
  assert.equal(result.execution.toolExecutions, 2);
  assert.deepEqual(
    provider.requests[0].tools.map((tool) => tool.name),
    ['search_hadith', 'get_hadith_detail', 'retrieve_related_evidence'],
  );
});

test('caller cancellation and orchestration output limits are enforced', async () => {
  const controller = new AbortController();
  controller.abort();
  const { orchestrator, telemetry } = harness(
    new ScriptedProvider([groundedResponse]),
  );
  await assert.rejects(
    () =>
      orchestrator.execute(context([{ role: 'user', content: 'Batalkan' }]), {
        signal: controller.signal,
      }),
    (error) =>
      error instanceof ConversationOrchestrationError &&
      error.code === 'ABORTED',
  );
  assert.equal(telemetry.snapshot()[0].status, 'aborted');

  const oversizedProvider = new ScriptedProvider([{ text: 'x'.repeat(5000) }]);
  const oversized = harness(
    oversizedProvider,
    gateway(),
    environment({ orchestrationMaxOutputBytes: 512 }),
  ).orchestrator;
  await assert.rejects(
    () =>
      oversized.execute(context([{ role: 'user', content: 'Output besar' }])),
    (error) =>
      error instanceof ConversationOrchestrationError &&
      error.code === 'OUTPUT_TOO_LARGE',
  );
});

test('context selection is suffix-bounded and requires a latest user turn', () => {
  const full = context([
    { role: 'user', content: 'a'.repeat(80) },
    { role: 'assistant', content: 'b'.repeat(80) },
    { role: 'user', content: 'c'.repeat(80) },
  ]);
  const selected = selectConversationContext(full, 120);
  assert.equal(selected.messages.length, 1);
  assert.equal(selected.messages[0].content, 'c'.repeat(80));
  assert.equal(selected.omittedMessageCount, 2);
  assert.throws(
    () =>
      selectConversationContext(
        context([{ role: 'assistant', content: 'bukan user terakhir' }]),
        1000,
      ),
    (error) =>
      error instanceof ConversationOrchestrationError &&
      error.code === 'INVALID_CONTEXT',
  );
});

test('conversation module is internal and API v1 remains unchanged', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  assert.ok(app.get(ConversationOrchestratorService));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  assert.equal((await fetch(`${base}/api/v2/conversations`)).status, 404);
  const response = await fetch(`${base}/api/v1/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'menuntut ilmu', limit: 1 }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).meta.modeUsed, 'mock');
});
