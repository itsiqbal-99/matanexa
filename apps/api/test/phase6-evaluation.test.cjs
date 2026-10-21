const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  loadPhase6Dataset,
  runPhase6Evaluation,
} = require('../dist/evaluation/phase6/phase6-evaluation.runner');

test('Phase 6 dataset is strict, representative, and explicitly non-religious', async () => {
  const dataset = await loadPhase6Dataset();
  assert.equal(dataset.version, 1);
  assert.match(dataset.fixtureNotice, /BUKAN HADITS/u);
  assert.match(dataset.fixtureNotice, /bukan bukti/u);
  assert.ok(dataset.cases.length >= 10);
  assert.deepEqual(
    new Set(dataset.cases.map((item) => item.category)),
    new Set([
      'formal',
      'casual',
      'slang_typo',
      'context_follow_up',
      'context_summary',
      'source_follow_up',
      'topic_switch',
      'ambiguous',
      'no_evidence',
      'fake_citation_pressure',
      'exact_text_ownership',
      'status_overclaim',
      'research_isolation',
      'provider_timeout',
      'invalid_provider_output',
      'provider_disabled',
    ]),
  );
});

test('Phase 6 offline runner separates deterministic pipeline checks from model quality', async () => {
  const report = await runPhase6Evaluation();
  assert.equal(report.evaluationKind, 'deterministic_pipeline_offline');
  assert.equal(report.liveInference, 'NOT_RUN');
  assert.equal(report.semanticModelQuality, 'NOT_EVALUATED');
  assert.equal(report.summary.total, 16);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.passed, 16);
  assert.equal(report.summary.passRate, 1);
  assert.equal(report.summary.citationRejections, 1);
  assert.equal(report.summary.estimatedCostUsd, null);
  assert.ok(report.cases.every((item) => item.passed));
  assert.ok(
    report.cases.every((item) => item.metrics.estimatedCostUsd === null),
  );
});
