import 'reflect-metadata';
import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { createApp } from '../../../create-app';
import { CloudflareEmbedding } from '../../../providers/embedding/cloudflare-embedding';
import { createPool } from '../../../database/connection';
import { evaluateMetrics, type EvaluationObservation } from './metrics';
const casesSchema = z.object({
  kind: z.literal('REAL_LOCAL_RESEARCH_PILOT'),
  judgmentMethod: z.string(),
  cases: z
    .array(
      z.object({
        id: z.string(),
        query: z.string(),
        expectedNumbers: z.array(z.string()),
        reason: z.string(),
        split: z.enum(['calibration', 'holdout']).default('calibration'),
      }),
    )
    .min(10),
});
const resultSchema = z.object({
  id: z.string(),
  hadithNumber: z.string(),
  indonesianText: z.string(),
  arabicText: z.string(),
  isVerified: z.literal(false),
  isResearchOnly: z.literal(true),
  grade: z.null(),
});
const responseSchema = z.object({
  data: z.object({
    query: z.string(),
    totalCandidates: z.number(),
    results: z.array(resultSchema),
  }),
  meta: z.object({
    modeUsed: z.enum(['lexical', 'hybrid', 'lexical_fallback']),
    dataScope: z.literal('local_pilot'),
    fallbackReason: z.string().optional(),
  }),
});
async function main() {
  config({ quiet: true });
  if (process.env.NODE_ENV !== 'development' || !process.env.DATABASE_URL)
    throw new Error('DEVELOPMENT_DATABASE_REQUIRED');
  const benchmark = process.argv.includes('--hybrid-benchmark');
  const root = resolve(process.cwd(), '../..'),
    out = resolve(root, benchmark ? 'artifacts/g26-hybrid' : 'artifacts/g26');
  await mkdir(out, { recursive: true });
  const cases = casesSchema.parse(
    JSON.parse(
      await readFile(
        resolve(
          root,
          benchmark
            ? 'tests/pilot/hybrid-queries.json'
            : 'tests/pilot/queries.json',
        ),
        'utf8',
      ),
    ) as unknown,
  );
  const pool = createPool(process.env.DATABASE_URL, 1, 10000);
  try {
    const ids = (
      await pool.query<{ id: string; hadith_number: string }>(
        "SELECT id,hadith_number FROM local_pilot_hadiths WHERE source_slug='fawaz-bukhari-local' ORDER BY hadith_number",
      )
    ).rows;
    const idFor = new Map(ids.map((row) => [row.hadith_number, row.id]));
    const counts = (
      await pool.query(
        "SELECT (SELECT count(*)::int FROM published_hadiths) AS published,(SELECT count(*)::int FROM local_pilot_hadiths) AS local_pilot,(SELECT count(*)::int FROM source_catalog WHERE permission_status='approved') AS approved_sources",
      )
    ).rows[0] as Record<string, number>;
    const runs = [];
    for (const mode of process.argv.includes('--lexical-only')
      ? (['lexical'] as const)
      : (['lexical', 'hybrid'] as const)) {
      process.env.APP_SEARCH_MODE = mode;
      process.env.APP_DATA_SCOPE = 'local_pilot';
      const app = await createApp(false);
      try {
        await app.listen(0, '127.0.0.1');
        const base = `${await app.getUrl()}/api/v1`,
          observations: EvaluationObservation[] = [],
          details = [];
        for (const item of cases.cases) {
          const started = performance.now();
          const response = await fetch(`${base}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: item.query, limit: 10 }),
          });
          const elapsed = performance.now() - started;
          if (!response.ok)
            throw new Error('PILOT_SEARCH_HTTP_' + response.status);
          const body = responseSchema.parse(await response.json());
          const expected = item.expectedNumbers.map((n) => {
            const id = idFor.get(n);
            if (!id) throw new Error('EXPECTED_REFERENCE_NOT_IMPORTED');
            return id;
          });
          const observation: EvaluationObservation = {
            id: item.id,
            category: 'real_pilot_anchor',
            split: item.split,
            query: item.query,
            expectedIds: expected,
            actualIds: body.data.results.map((row) => row.id),
            expectedTopic: null,
            actualTopics: [],
            latencyMs: elapsed,
          };
          observations.push(observation);
          details.push({
            ...item,
            expectedDatabaseIds: expected,
            modeUsed: body.meta.modeUsed,
            fallbackReason: body.meta.fallbackReason ?? null,
            latencyMs: elapsed,
            totalCandidates: body.data.totalCandidates,
            results: body.data.results.map((row) => ({
              ...row,
              judgment: expected.includes(row.id)
                ? 'relevant_anchor'
                : 'unjudged',
            })),
          });
          console.log(
            JSON.stringify({
              progress: item.id,
              requestedMode: mode,
              returned: body.data.results.length,
            }),
          );
        }
        const metrics = evaluateMetrics(observations);
        const {
          recallAt10: omittedRecall,
          topicRoutingAccuracy: omittedRouting,
          ...valid
        } = metrics;
        void omittedRecall;
        void omittedRouting;
        runs.push({
          requestedMode: mode,
          observedModes: [...new Set(details.map((x) => x.modeUsed))],
          metrics: valid,
          api: app.get(CloudflareEmbedding).statistics,
          bySplit: Object.fromEntries(
            ['calibration', 'holdout'].map((split) => {
              const { recallAt10, topicRoutingAccuracy, ...metrics } =
                evaluateMetrics(observations.filter((o) => o.split === split));
              void recallAt10;
              void topicRoutingAccuracy;
              return [split, metrics];
            }),
          ),
          cases: details,
        });
      } finally {
        await app.close();
      }
    }
    const report = {
      kind: 'REAL_LOCAL_RESEARCH_PILOT',
      createdAt: new Date().toISOString(),
      counts,
      judgmentMethod: cases.judgmentMethod,
      precisionScope:
        'Judged-positive lower bound; unjudged results are not asserted irrelevant. No exhaustive recall or held-out evaluation.',
      realHybridMeasured: runs.some((r) => r.observedModes.includes('hybrid')),
      runs,
    };
    await writeFile(
      resolve(out, 'evaluation.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(
      JSON.stringify(
        {
          ...report,
          runs: runs.map((r) => ({
            requestedMode: r.requestedMode,
            observedModes: r.observedModes,
            metrics: r.metrics,
            examples: r.cases.map((c) => ({
              id: c.id,
              numbers: c.results.slice(0, 5).map((x) => x.hadithNumber),
              fallbackReason: c.fallbackReason,
            })),
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}
void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      code:
        error instanceof Error &&
        /^(PILOT_SEARCH_HTTP_\d+|EXPECTED_REFERENCE_NOT_IMPORTED|DEVELOPMENT_DATABASE_REQUIRED)$/.test(
          error.message,
        )
          ? error.message
          : error instanceof z.ZodError
            ? 'PILOT_RESPONSE_SCHEMA_ERROR'
            : 'PILOT_EVALUATION_FAILED',
    }),
  );
  console.error(
    'PILOT_EVALUATION_FAILED — no credentials or raw database error logged.',
  );
  process.exitCode = 1;
});
