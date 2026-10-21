const assert = require('node:assert/strict');
const { test } = require('node:test');
require('dotenv').config({ quiet: true });
const { readEnvironment } = require('../dist/config/environment');
const {
  CloudflareLlmAdapter,
} = require('../dist/providers/llm/cloudflare-llm.adapter');

const enabled = process.env.RUN_LIVE_CLOUDFLARE_LLM === '1';
const maxTokens = Number(process.env.AI_LLM_LIVE_MAX_TOKENS);
const maxRequests = Number(process.env.AI_LLM_LIVE_MAX_REQUESTS);
const tokenBudget = Number(process.env.AI_LLM_LIVE_TOKEN_BUDGET);

test(
  'Cloudflare LLM live contract (explicit opt-in and bounded usage)',
  { skip: enabled ? false : 'NOT RUN: RUN_LIVE_CLOUDFLARE_LLM is not 1' },
  async () => {
    assert.equal(
      process.env.AI_LLM_LIVE_INFERENCE_APPROVED,
      '1',
      'Persetujuan inference eksplisit belum direkam.',
    );
    assert.equal(
      process.env.AI_LLM_LIVE_PRIVACY_APPROVED,
      '1',
      'Privacy/data processing belum disetujui.',
    );
    assert.equal(
      process.env.AI_LLM_LIVE_QUOTA_APPROVED,
      '1',
      'Free quota/cost ceiling belum disetujui.',
    );
    assert.equal(
      process.env.AI_LLM_LIVE_DATA_SCOPE,
      'synthetic_only',
      'Live contract test hanya boleh mengirim prompt sintetis.',
    );
    assert.equal(maxRequests, 1, 'Contract probe dibatasi tepat satu request.');
    assert.ok(
      Number.isInteger(maxTokens) && maxTokens >= 1 && maxTokens <= 32,
      'AI_LLM_LIVE_MAX_TOKENS harus eksplisit 1–32.',
    );
    assert.ok(
      Number.isInteger(tokenBudget) &&
        tokenBudget >= maxTokens &&
        tokenBudget <= 64,
      'AI_LLM_LIVE_TOKEN_BUDGET harus eksplisit dan bernilai 1–64.',
    );
    const environment = readEnvironment(process.env);
    assert.equal(environment.llmProvider, 'cloudflare');
    const provider = new CloudflareLlmAdapter(environment);
    const result = await provider.generate({
      modelId: environment.llmModel,
      messages: [{ role: 'user', content: 'Return exactly the word OK.' }],
      maxOutputTokens: maxTokens,
      temperature: 0,
    });
    assert.equal(result.providerId, 'cloudflare');
    assert.equal(typeof result.text, 'string');
    assert.ok(result.text.length > 0);
  },
);
