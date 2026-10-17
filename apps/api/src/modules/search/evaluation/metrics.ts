export interface EvaluationObservation {
  id: string;
  category: string;
  split: 'calibration' | 'holdout';
  query: string;
  expectedIds: string[];
  actualIds: string[];
  expectedTopic: string | null;
  actualTopics: string[];
  latencyMs: number;
}
function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}
export function evaluateMetrics(rows: EvaluationObservation[]) {
  const positive = rows.filter((row) => row.expectedIds.length > 0);
  const negative = rows.filter((row) => !row.expectedIds.length);
  const hit = (row: EvaluationObservation, k: number) =>
    [...new Set(row.actualIds.slice(0, k))].filter((id) =>
      row.expectedIds.includes(id),
    ).length;
  return {
    queryCount: rows.length,
    positiveJudgedQueries: positive.length,
    noResultJudgedQueries: negative.length,
    precisionAt5: mean(positive.map((row) => hit(row, 5) / 5)),
    recallAt10: mean(
      positive.map((row) => hit(row, 10) / new Set(row.expectedIds).size),
    ),
    mrrAt10: mean(
      positive.map((row) => {
        const rank = row.actualIds
          .slice(0, 10)
          .findIndex((id) => row.expectedIds.includes(id));
        return rank < 0 ? 0 : 1 / (rank + 1);
      }),
    ),
    hitRateAt5: mean(positive.map((row) => (hit(row, 5) > 0 ? 1 : 0))),
    zeroResultRate: mean(
      rows.map((row) => (row.actualIds.length === 0 ? 1 : 0)),
    ),
    noResultAccuracy: mean(
      negative.map((row) => (row.actualIds.length === 0 ? 1 : 0)),
    ),
    topicRoutingAccuracy: mean(
      rows.map((row) =>
        row.expectedTopic === null
          ? Number(row.actualTopics.length === 0)
          : Number(
              row.actualTopics.length === 1 &&
                row.actualTopics[0] === row.expectedTopic,
            ),
      ),
    ),
    latencyMs: {
      p50: percentile(
        rows.map((row) => row.latencyMs),
        0.5,
      ),
      p95: percentile(
        rows.map((row) => row.latencyMs),
        0.95,
      ),
    },
  };
}
export function summarize(rows: EvaluationObservation[]) {
  return {
    overall: evaluateMetrics(rows),
    byCategory: Object.fromEntries(
      [...new Set(rows.map((row) => row.category))]
        .sort()
        .map((category) => [
          category,
          evaluateMetrics(rows.filter((row) => row.category === category)),
        ]),
    ),
    bySplit: {
      calibration: evaluateMetrics(
        rows.filter((row) => row.split === 'calibration'),
      ),
      holdout: evaluateMetrics(rows.filter((row) => row.split === 'holdout')),
    },
  };
}
