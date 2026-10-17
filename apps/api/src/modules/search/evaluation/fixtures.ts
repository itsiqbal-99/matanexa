import { z } from 'zod';
import { normalizeSearchText } from '../query-normalizer';
import type { PoolClient } from 'pg';
import { LEXICAL_DIAGNOSTIC_SQL } from '../search.repository';
// Private test/CLI relation only. Never alter the publication view or expose a provider switch through Nest.
export const EVALUATION_SQL = LEXICAL_DIAGNOSTIC_SQL.replace(
  'FROM published_hadiths h',
  'FROM pg_temp.matanexa_eval_documents h',
);
export async function preparePostgresFixtures(
  client: PoolClient,
  documents: EvaluationDocument[],
): Promise<void> {
  await client.query(`CREATE TEMP TABLE matanexa_eval_documents (
    id text,source_id text,collection_id text,source_slug text,hadith_number text,numbering_scheme text,
    book_name text,chapter_name text,indonesian_text text,normalized_translation text,topic_slugs text[],
    search_document tsvector GENERATED ALWAYS AS(to_tsvector('simple',normalized_translation || ' ' || book_name || ' ' || chapter_name)) STORED)`);
  await client.query(
    `INSERT INTO pg_temp.matanexa_eval_documents(id,source_id,collection_id,source_slug,hadith_number,numbering_scheme,
    book_name,chapter_name,indonesian_text,normalized_translation,topic_slugs)
    SELECT * FROM jsonb_to_recordset($1) AS x(id text,source_id text,collection_id text,source_slug text,hadith_number text,numbering_scheme text,
    book_name text,chapter_name text,indonesian_text text,normalized_translation text,topic_slugs text[])`,
    [JSON.stringify(documents)],
  );
  await client.query(
    'CREATE INDEX ON pg_temp.matanexa_eval_documents USING gin(search_document)',
  );
  await client.query(
    'CREATE INDEX ON pg_temp.matanexa_eval_documents USING gin(normalized_translation gin_trgm_ops)',
  );
  await client.query('ANALYZE pg_temp.matanexa_eval_documents');
}
const fixtureSchema = z.object({
  kind: z.literal('SIMULATION_ONLY_TOPIC_RETRIEVAL'),
  judgments: z.string(),
  topics: z.record(z.string(), z.array(z.string()).length(5)),
  partialJudgments: z.record(
    z.string(),
    z.object({ ids: z.array(z.string()), reason: z.string() }),
  ),
  queries: z
    .array(z.tuple([z.string(), z.string().nullable(), z.string(), z.string()]))
    .min(50),
});
export interface EvaluationDocument {
  id: string;
  source_id: string;
  collection_id: string;
  source_slug: string;
  hadith_number: string;
  numbering_scheme: string;
  book_name: string;
  chapter_name: string;
  indonesian_text: string;
  normalized_translation: string;
  topic_slugs: string[];
}
export interface EvaluationCase {
  id: string;
  query: string;
  expectedTopic: string | null;
  category: string;
  reason: string;
  expectedNoResult: boolean;
  expectedFixtureIds: string[];
  partiallyRelevantFixtureIds: string[];
  judgments: {
    fixtureId: string;
    relevance: 'relevant' | 'partial' | 'irrelevant';
    reason: string;
  }[];
  expectedHadithIdsVerified: null;
  split: 'calibration' | 'holdout';
}
export function loadFixtures(input: unknown): {
  documents: EvaluationDocument[];
  cases: EvaluationCase[];
  judgments: string;
} {
  const data = fixtureSchema.parse(input);
  const documents: EvaluationDocument[] = Object.entries(data.topics).flatMap(
    ([topic, labels]) =>
      labels.map((label, index) => ({
        id: `SIM-${topic}-${index + 1}`,
        source_id: 'SIM-SOURCE',
        source_slug: 'simulation-test',
        collection_id: `SIM-COLLECTION-${index === 4 ? 'B' : 'A'}`,
        hadith_number: `SIMULASI-${index + 1}`,
        numbering_scheme: `SIMULASI-${topic}`,
        book_name: `SIMULASI label ${label}`,
        chapter_name: `SIMULASI bab ${label}`,
        indonesian_text: `SIMULASI — LABEL TOPIK PENGUJIAN: ${label}`,
        normalized_translation: normalizeSearchText(
          `SIMULASI — LABEL TOPIK PENGUJIAN: ${label}`,
        ),
        topic_slugs: [topic],
      })),
  );
  documents.push({ ...documents[0], id: 'SIM-knowledge-duplicate' });
  for (const [index, label] of [
    'ibu kota geografi',
    'tangan kanan mesin',
  ].entries())
    documents.push({
      ...documents[0],
      id: `SIM-NOISE-${index + 1}`,
      collection_id: 'SIM-NOISE',
      numbering_scheme: 'SIMULASI-NOISE',
      hadith_number: `SIMULASI-NOISE-${index + 1}`,
      book_name: `SIMULASI label ${label}`,
      chapter_name: 'SIMULASI pengecoh',
      indonesian_text: `SIMULASI label pengecoh ${label}`,
      normalized_translation: normalizeSearchText(
        `SIMULASI label pengecoh ${label}`,
      ),
      topic_slugs: [],
    });
  const cases: EvaluationCase[] = data.queries.map(
    ([query, expectedTopic, category, reason], index) => {
      if (expectedTopic && !(expectedTopic in data.topics))
        throw new Error('Unknown fixture topic');
      const id = `G3-${String(index + 1).padStart(2, '0')}`;
      const topicIds = expectedTopic
        ? Array.from({ length: 5 }, (_, i) => `SIM-${expectedTopic}-${i + 1}`)
        : [];
      const partial = data.partialJudgments[id];
      if (partial?.ids.some((item) => !topicIds.includes(item)))
        throw new Error('Partial judgment outside expected fixture topic');
      return {
        id,
        query,
        expectedTopic,
        category,
        reason,
        expectedNoResult: expectedTopic === null,
        expectedFixtureIds: topicIds.filter(
          (item) => !partial?.ids.includes(item),
        ),
        partiallyRelevantFixtureIds: partial?.ids ?? [],
        judgments: documents
          .filter((doc) => !doc.id.endsWith('-duplicate'))
          .map((doc) => ({
            fixtureId: doc.id,
            relevance: partial?.ids.includes(doc.id)
              ? 'partial'
              : topicIds.includes(doc.id)
                ? 'relevant'
                : 'irrelevant',
            reason: partial?.ids.includes(doc.id)
              ? partial.reason
              : topicIds.includes(doc.id)
                ? `Label topik simulasi sesuai: ${reason}; bukan penilaian hadits nyata.`
                : 'Label simulasi di luar topik yang diharapkan; bukan penilaian hadits nyata.',
          })),
        expectedHadithIdsVerified: null,
        split: index % 4 === 3 ? 'holdout' : 'calibration',
      };
    },
  );
  return { documents, cases, judgments: data.judgments };
}
