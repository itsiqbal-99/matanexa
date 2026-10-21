const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { readEnvironment } = require('../dist/config/environment');
const {
  CloudflareEmbeddingAdapter,
} = require('../dist/providers/embedding/cloudflare-embedding');
const {
  ACTIVE_EMBEDDING_DIMENSIONS,
  ACTIVE_EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
} = require('../dist/providers/embedding/embedding-provider');
const {
  MockEmbeddingProvider,
} = require('../dist/providers/embedding/mock-embedding.provider');
const {
  CloudflareLlmAdapter,
} = require('../dist/providers/llm/cloudflare-llm.adapter');
const {
  DisabledLlmProvider,
} = require('../dist/providers/llm/disabled-llm.provider');
const { MockLlmProvider } = require('../dist/providers/llm/mock-llm.provider');
const {
  validateOpenAiCompatibleBaseUrl,
} = require('../dist/providers/llm/openai-compatible');
const { LLM_PROVIDER } = require('../dist/providers/llm/llm-provider');
const { ProviderError } = require('../dist/providers/provider-contract');
const {
  ProviderTelemetryCollector,
} = require('../dist/providers/provider-telemetry');
const { createApp } = require('../dist/create-app');

const model = '@cf/meta/llama-3.1-8b-instruct-fp8';
const secret = 'SIMULATION_PRIVATE_TOKEN';
const prompt = 'SIMULATION_PRIVATE_PROMPT';

function environment(overrides = {}) {
  return {
    llmProvider: 'cloudflare',
    llmModel: model,
    llmTimeoutMs: 1000,
    llmMaxConcurrency: 2,
    cloudflareAccountId: 'a'.repeat(32),
    cloudflareApiToken: secret,
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    modelId: model,
    messages: [{ role: 'user', content: prompt }],
    maxOutputTokens: 16,
    correlationId: randomUUID(),
    ...overrides,
  };
}

async function collect(iterable) {
  const values = [];
  for await (const value of iterable) values.push(value);
  return values;
}

test('provider module binds disabled LLM and Cloudflare embedding without remote calls', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  assert.equal(app.get(LLM_PROVIDER) instanceof DisabledLlmProvider, true);
  assert.equal(
    app.get(EMBEDDING_PROVIDER) instanceof CloudflareEmbeddingAdapter,
    true,
  );
});

test('mock and Cloudflare implement the same normalized generation contract', async () => {
  let calls = 0;
  const telemetry = new ProviderTelemetryCollector();
  const cloudflare = new CloudflareLlmAdapter(
    environment(),
    async (url, options) => {
      calls++;
      assert.equal(
        url,
        `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/ai/run/${model}`,
      );
      assert.equal(options.headers.Authorization, `Bearer ${secret}`);
      assert.deepEqual(JSON.parse(options.body), {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16,
      });
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            response: 'CLOUD_RESPONSE',
            finish_reason: 'stop',
            usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
          },
        }),
      );
    },
    telemetry,
  );
  const mock = new MockLlmProvider(model);
  for (const provider of [cloudflare, mock]) {
    const result = await provider.generate(request());
    assert.equal(result.providerId, provider.providerId);
    assert.equal(result.modelId, model);
    assert.equal(typeof result.text, 'string');
    assert.equal(result.finishReason, 'stop');
    assert.equal(typeof result.usage.totalTokens, 'number');
  }
  const structured = await mock.generate(
    request({ responseFormat: { type: 'json_object' } }),
  );
  assert.deepEqual(JSON.parse(structured.text), { status: 'MOCK_RESPONSE' });
  assert.equal(calls, 1);
  const telemetryText = JSON.stringify(telemetry.snapshot());
  assert.ok(!telemetryText.includes(secret));
  assert.ok(!telemetryText.includes(prompt));
  assert.equal(telemetry.snapshot()[0].usage.totalTokens, 5);
});

test('Cloudflare streaming is normalized and unknown model capabilities fail closed', async () => {
  const provider = new CloudflareLlmAdapter(environment(), async () => {
    const body = [
      'data: {"response":"CLOUD_"}',
      'data: {"response":"STREAM"}',
      'data: {"usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}',
      'data: [DONE]',
      '',
    ].join('\n');
    return new Response(body, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  });
  const events = await collect(provider.stream(request()));
  assert.equal(
    events
      .filter((event) => event.type === 'text_delta')
      .map((event) => event.text)
      .join(''),
    'CLOUD_STREAM',
  );
  assert.equal(events.at(-1).type, 'done');

  const unknownModel = '@cf/vendor/unverified-model';
  const unknown = new CloudflareLlmAdapter(
    environment({ llmModel: unknownModel }),
    async () => {
      throw new Error('transport must not run');
    },
  );
  await assert.rejects(
    () => collect(unknown.stream(request({ modelId: unknownModel }))),
    (error) =>
      error instanceof ProviderError && error.code === 'UNSUPPORTED_CAPABILITY',
  );
});

test('unsupported tools and structured output are rejected before transport', async () => {
  let calls = 0;
  const telemetry = new ProviderTelemetryCollector();
  const provider = new CloudflareLlmAdapter(
    environment(),
    async () => {
      calls++;
      throw new Error('transport must not run');
    },
    telemetry,
  );
  for (const extra of [
    {
      tools: [
        {
          name: 'lookup',
          description: 'test-only',
          inputSchema: { type: 'object' },
        },
      ],
    },
    { responseFormat: { type: 'json_object' } },
  ])
    await assert.rejects(
      () => provider.generate(request(extra)),
      (error) =>
        error instanceof ProviderError &&
        error.code === 'UNSUPPORTED_CAPABILITY',
    );
  assert.equal(calls, 0);
  assert.deepEqual(
    telemetry.snapshot().map((record) => record.errorCode),
    ['UNSUPPORTED_CAPABILITY', 'UNSUPPORTED_CAPABILITY'],
  );
  assert.ok(!JSON.stringify(telemetry.snapshot()).includes(prompt));
});

test('Cloudflare timeout and caller cancellation are distinct normalized errors', async () => {
  const waitingTransport = async (_url, options) =>
    new Promise((_resolve, reject) => {
      if (options.signal.aborted)
        reject(new DOMException('aborted', 'AbortError'));
      else
        options.signal.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        );
    });
  const timed = new CloudflareLlmAdapter(
    environment({ llmTimeoutMs: 20 }),
    waitingTransport,
  );
  await assert.rejects(
    () => timed.generate(request()),
    (error) => error instanceof ProviderError && error.code === 'TIMEOUT',
  );

  const controller = new AbortController();
  controller.abort();
  const cancelled = new CloudflareLlmAdapter(environment(), waitingTransport);
  await assert.rejects(
    () => cancelled.generate(request(), { signal: controller.signal }),
    (error) => error instanceof ProviderError && error.code === 'ABORTED',
  );
});

test('Cloudflare rejects invalid payloads and normalizes provider status codes', async () => {
  for (const [response, code] of [
    [new Response('{bad'), 'INVALID_RESPONSE'],
    [
      new Response(
        JSON.stringify({ success: true, result: { response: 123 } }),
      ),
      'INVALID_RESPONSE',
    ],
    [new Response('', { status: 401 }), 'AUTHENTICATION_FAILED'],
    [new Response('', { status: 429 }), 'RATE_LIMITED'],
    [new Response('', { status: 503 }), 'UNAVAILABLE'],
  ])
    await assert.rejects(
      () =>
        new CloudflareLlmAdapter(environment(), async () => response).generate(
          request(),
        ),
      (error) => error instanceof ProviderError && error.code === code,
    );
});

test('LLM configuration is backend-only, bounded and disabled by default', () => {
  const defaults = readEnvironment({});
  assert.equal(defaults.llmProvider, 'disabled');
  assert.equal(defaults.llmTimeoutMs, 30000);
  assert.equal(defaults.llmMaxConcurrency, 2);
  for (const invalid of [
    { AI_LLM_PROVIDER: 'arbitrary' },
    { AI_LLM_TIMEOUT_MS: '99' },
    { AI_LLM_TIMEOUT_MS: '120001' },
    { AI_LLM_MAX_CONCURRENCY: '0' },
    { AI_LLM_MAX_CONCURRENCY: '5' },
    { AI_LLM_PROVIDER: 'cloudflare' },
    {
      AI_LLM_PROVIDER: 'cloudflare',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      CLOUDFLARE_API_TOKEN: secret,
      AI_LLM_MODEL: 'https://client-controlled.invalid/model',
    },
  ])
    assert.throws(() => readEnvironment(invalid));
  const configured = readEnvironment({
    AI_LLM_PROVIDER: 'cloudflare',
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    CLOUDFLARE_API_TOKEN: secret,
    AI_LLM_MODEL: model,
  });
  assert.equal(configured.llmProvider, 'cloudflare');
  assert.equal(configured.llmModel, model);
});

test('OpenAI-compatible endpoint policy separates hosted and loopback profiles', () => {
  assert.equal(
    validateOpenAiCompatibleBaseUrl(
      'https://inference.example.test/v1/',
      'hosted',
    ).origin,
    'https://inference.example.test',
  );
  assert.equal(
    validateOpenAiCompatibleBaseUrl(
      'http://127.0.0.1:11434/v1/',
      'self_hosted_loopback',
    ).port,
    '11434',
  );
  for (const [url, profile] of [
    ['http://inference.example.test/v1', 'hosted'],
    ['https://127.0.0.1/v1', 'hosted'],
    ['https://192.168.1.4/v1', 'hosted'],
    ['https://[fd00::1]/v1', 'hosted'],
    ['http://169.254.169.254/latest', 'hosted'],
    ['http://0.0.0.0:8000/v1', 'self_hosted_loopback'],
    ['http://user:pass@localhost:11434/v1', 'self_hosted_loopback'],
  ])
    assert.throws(() => validateOpenAiCompatibleBaseUrl(url, profile));
});

test('mock embedding is deterministic and preserves BGE-M3 dimensions contract', async () => {
  const provider = new MockEmbeddingProvider();
  const first = await provider.embed(['SIMULATION']);
  const second = await provider.embed(['SIMULATION']);
  assert.deepEqual(first, second);
  assert.equal(first[0].length, ACTIVE_EMBEDDING_DIMENSIONS);
  assert.equal(ACTIVE_EMBEDDING_MODEL, '@cf/baai/bge-m3');
});
