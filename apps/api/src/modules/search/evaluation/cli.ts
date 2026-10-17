import 'reflect-metadata';
import { config } from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { createSessionPool } from '../../../database/connection';
import { QueryNormalizer } from '../query-normalizer';
import { QueryAnalyzer } from '../query-analyzer';
import { SynonymService } from '../synonym.service';
import {
  RelevanceRanker,
  WEIGHT_PROFILES,
  RANKING_VERSION,
} from '../relevance-ranker';
import { searchParameters } from '../search.repository';
import { VOCABULARY_VERSION } from '../search-vocabulary';
import {
  loadFixtures,
  preparePostgresFixtures,
  EVALUATION_SQL as fixtureSQL,
} from './fixtures';
import {
  summarize,
  evaluateMetrics,
  type EvaluationObservation,
} from './metrics';
import { G2_BASELINE_SQL, baselineTerms } from './g2-baseline';
import { normalizeQuery } from '../search.schema';

interface Candidate extends QueryResultRow {
  id: string;
  source_slug: string;
  collection_id: string;
  numbering_scheme: string;
  hadith_number: string;
  relevance: number;
  primary_signal: number;
  phrase_signal: number;
  equivalent_signal: number;
  topic_signal: number;
  related_signal: number;
  chapter_signal: number;
  fts_signal: number;
  typo_signal: number;
  negation_signal: number;
  document_text: string;
}
// Only this CLI uses a temporary fixture relation. Nest has no flag/provider that bypasses the publication view.
async function main(): Promise<void> {
  config({ quiet: true });
  if (!process.env.TEST_DATABASE_URL)
    throw new Error('TEST_DATABASE_URL_MISSING');
  const root = resolve(process.cwd(), '../..');
  const raw = await readFile(
    resolve(root, 'tests/fixtures/g3-search.json'),
    'utf8',
  );
  const fixture = loadFixtures(JSON.parse(raw) as unknown);
  const analyzer = new QueryAnalyzer(
    new QueryNormalizer(),
    new SynonymService(),
  );
  const ranker = new RelevanceRanker();
  const pool = createSessionPool(process.env.TEST_DATABASE_URL);
  try {
    const client = await pool.connect();
    try {
      await preparePostgresFixtures(client, fixture.documents);
      const baseline: EvaluationObservation[] = [],
        current: EvaluationObservation[] = [];
      const calibration: Record<string, EvaluationObservation[]> =
        Object.fromEntries(
          Object.keys(WEIGHT_PROFILES).map((key) => [key, []]),
        );
      for (const item of fixture.cases) {
        const analysis = analyzer.analyze(item.query);
        const common = {
          id: item.id,
          category: item.category,
          split: item.split,
          query: item.query,
          expectedIds: item.expectedFixtureIds,
          expectedTopic: item.expectedTopic,
          actualTopics: analysis.topicSlugs,
        };
        const startBaseline = performance.now();
        const old = await client.query<{ id: string }>(G2_BASELINE_SQL, [
          baselineTerms(item.query),
          normalizeQuery(item.query),
        ]);
        // Old G2 had no explicit router: routing metrics intentionally unavailable for that baseline.
        baseline.push({
          ...common,
          actualIds: old.rows.map((row) => row.id),
          latencyMs: performance.now() - startBaseline,
        });
        const started = performance.now();
        const result = await client.query<{
          results: Candidate[];
          total: number;
        }>(
          fixtureSQL,
          searchParameters(
            { query: item.query, page: 1, limit: 20 },
            analysis,
            ranker.weights,
          ),
        );
        const elapsed = performance.now() - started;
        const rows = result.rows[0].results;
        if (result.rows[0].total > 20)
          throw new Error('FIXTURE_CANDIDATES_TRUNCATED');
        current.push({
          ...common,
          actualIds: rows.map((row) => row.id),
          latencyMs: elapsed,
        });
        for (const [profile, weights] of Object.entries(WEIGHT_PROFILES)) {
          const score = (row: Candidate) =>
            ranker.score(
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
                negationMissing:
                  analysis.negations.length > 0 && row.negation_signal === 0
                    ? 1
                    : 0,
              },
              weights,
              [...row.document_text].length,
            );
          if (
            profile === 'balanced' &&
            rows.some((row) => Math.abs(score(row) - row.relevance) > 0.00001)
          )
            throw new Error('SQL_RANKER_FORMULA_MISMATCH');
          const ordered = [...rows].sort(
            (a, b) =>
              score(b) - score(a) ||
              [
                a.source_slug,
                a.collection_id,
                a.numbering_scheme,
                a.hadith_number,
                a.id,
              ]
                .join('|')
                .localeCompare(
                  [
                    b.source_slug,
                    b.collection_id,
                    b.numbering_scheme,
                    b.hadith_number,
                    b.id,
                  ].join('|'),
                ),
          );
          calibration[profile].push({
            ...common,
            actualIds: ordered.map((row) => row.id),
            latencyMs: elapsed,
          });
        }
        if (current.length % 16 === 0)
          console.log(
            `SIMULATION progress ${current.length}/${fixture.cases.length}`,
          );
      }
      const profiles = Object.fromEntries(
        Object.entries(calibration).map(([profile, rows]) => [
          profile,
          evaluateMetrics(rows.filter((row) => row.split === 'calibration')),
        ]),
      );
      const bestCalibrationProfile = Object.entries(profiles).sort(
        (a, b) =>
          (b[1].mrrAt10 ?? 0) - (a[1].mrrAt10 ?? 0) ||
          (b[1].precisionAt5 ?? 0) - (a[1].precisionAt5 ?? 0),
      )[0][0];
      const first = fixture.cases[0];
      const analysis = analyzer.analyze(first.query);
      const explain = await client.query<Record<string, unknown>>(
        'EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + fixtureSQL,
        searchParameters(
          { query: first.query, page: 1, limit: 10 },
          analysis,
          ranker.weights,
        ),
      );
      const baselineSummary = summarize(baseline);
      // Do not attribute the new analyzer to the historical G2 router.
      for (const section of [
        baselineSummary.overall,
        ...Object.values(baselineSummary.byCategory),
        ...Object.values(baselineSummary.bySplit),
      ])
        section.topicRoutingAccuracy = null;
      const report = {
        kind: 'SIMULATION_ONLY_POSTGRES_TOPIC_RETRIEVAL',
        createdAt: new Date().toISOString(),
        corpus: {
          fixtureRows: fixture.documents.length,
          canonicalFixtures: fixture.documents.length - 1,
          realHadiths: 0,
        },
        fixtureSha256: createHash('sha256').update(raw).digest('hex'),
        generatedCorpusSha256: createHash('sha256')
          .update(JSON.stringify(fixture.documents))
          .digest('hex'),
        vocabularyVersion: VOCABULARY_VERSION,
        rankingVersion: RANKING_VERSION,
        realHadithMetrics: null,
        judgmentScope: fixture.judgments,
        metricDefinitions: {
          precisionAt5:
            'relevant unique IDs in top 5 / 5; macro over positive judged fixture queries',
          recallAt10:
            'relevant unique IDs in top 10 / all relevant synthetic IDs; exhaustive ONLY for this fixture corpus',
          latency:
            'sequential client roundtrip ms to Neon TEMP fixture tables; excludes HTTP and UI; not production latency',
          weightProfiles:
            'rescored from the same SQL feature rows; repeated latency values are not independent profile benchmarks',
        },
        baselineG2: baselineSummary,
        currentG3: summarize(current),
        calibrationProfiles: profiles,
        weightSelection: {
          bestCalibrationProfile,
          implementationProfile: 'balanced',
          criterion:
            'MRR@10 then Precision@5 on 48 calibration queries; ties keep the earlier profile; no claim of global optimality',
        },
        implementationWeights: ranker.weights,
        profileWeights: WEIGHT_PROFILES,
        explain: explain.rows,
        cases: fixture.cases.map((item, index) => ({
          ...item,
          analysis: analyzer.analyze(item.query),
          top5Judgments: current[index].actualIds.slice(0, 5).map((id) => ({
            id,
            label: fixture.documents.find((document) => document.id === id)
              ?.indonesian_text,
            judgment: item.judgments.find(
              (judgment) => judgment.fixtureId === id,
            ),
          })),
          baseline: baseline[index],
          current: current[index],
        })),
      };
      await writeFile(
        resolve(root, 'docs/G3_BASELINE.json'),
        JSON.stringify(report, null, 2) + '\n',
      );
      await writeFile(
        resolve(root, 'docs/G3_EVALUATION_CASES.json'),
        JSON.stringify(
          { kind: 'SIMULATION_ONLY', cases: fixture.cases },
          null,
          2,
        ) + '\n',
      );
      console.log(
        JSON.stringify(
          {
            kind: report.kind,
            baseline: baselineSummary.overall,
            current: report.currentG3.overall,
            calibrationProfiles: profiles,
          },
          null,
          2,
        ),
      );
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
void main().catch((error: unknown) => {
  const code =
    error instanceof Error &&
    [
      'TEST_DATABASE_URL_MISSING',
      'FIXTURE_CANDIDATES_TRUNCATED',
      'SQL_RANKER_FORMULA_MISMATCH',
    ].includes(error.message)
      ? error.message
      : 'EVALUATION_FAILED';
  const dbCode =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{2,30}$/.test(error.code)
      ? error.code
      : undefined;
  console.error(JSON.stringify({ code, dbCode }));
  process.exitCode = 1;
});
