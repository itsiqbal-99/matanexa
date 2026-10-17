import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { normalizeIndexText } from '../modules/search/query-normalizer';

const text = z
  .string()
  .min(1)
  .max(50000)
  .refine((value) => value.trim().length > 0);
const label = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => value.trim().length > 0);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const url = z
  .url()
  .max(2000)
  .refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  });
export const importRecordSchema = z
  .object({
    collection: z
      .object({ slug, name: label, originalName: label.optional() })
      .strict(),
    hadithNumber: label,
    numberingScheme: label,
    bookName: label,
    chapterName: label.optional(),
    narrator: label.optional(),
    arabicText: text,
    indonesianText: text,
    translationAttribution: label,
    referenceUrl: url,
    provenance: z
      .object({
        repository: url,
        revision: z.string().regex(/^[a-f0-9]{40}$/),
        arabicEdition: label,
        indonesianEdition: label,
        arabicUrl: url,
        indonesianUrl: url,
        arabicFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
        indonesianFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
        sourceBook: z.number().int().positive(),
        sourceHadith: z.number().int().positive(),
        pairingStatus: z.literal('identity_matched'),
        humanReview: z.literal('pending'),
      })
      .strict()
      .optional(),
    grade: z
      .object({ text: label, grader: label, sourceUrl: url })
      .strict()
      .optional(),
  })
  .strict();
export const datasetSchema = z
  .object({
    sourceSlug: slug,
    datasetVersion: label,
    datasetUrl: url,
    records: z.array(z.unknown()).min(1).max(10000),
  })
  .strict();
export type ImportRecord = z.infer<typeof importRecordSchema>;
export function recordIdentity(record: ImportRecord): string {
  return JSON.stringify([
    record.collection.slug,
    record.numberingScheme,
    record.hadithNumber,
  ]);
}
export function contentHash(record: ImportRecord): string {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}
export interface ImportReport {
  runId: string;
  dryRun: boolean;
  committed: boolean;
  imported: number;
  updated: number;
  skipped: number;
  duplicated: number;
  failed: number;
  failures: { index: number; code: string; fields?: string[] }[];
}
export async function importDataset(
  client: PoolClient,
  input: unknown,
  fileHash: string,
  options: { dryRun?: boolean; researchOnly?: boolean } = {},
): Promise<ImportReport> {
  const dataset = datasetSchema.parse(input);
  const report: ImportReport = {
    runId: '',
    dryRun: options.dryRun === true,
    committed: false,
    imported: 0,
    updated: 0,
    skipped: 0,
    duplicated: 0,
    failed: 0,
    failures: [],
  };
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      dataset.sourceSlug,
    ]);
    const sources = await client.query<{ id: string }>(
      'SELECT id FROM source_catalog WHERE slug=$1 AND permission_status=$2 FOR SHARE',
      [dataset.sourceSlug, options.researchOnly ? 'research_only' : 'approved'],
    );
    const source = sources.rows[0];
    if (!source) throw new Error('SOURCE_NOT_APPROVED');
    if (
      options.researchOnly &&
      (process.env.NODE_ENV !== 'development' ||
        dataset.records.some(
          (record) =>
            !importRecordSchema.safeParse(record).success ||
            !importRecordSchema.parse(record).provenance,
        ))
    )
      throw new Error('RESEARCH_IMPORT_REQUIRES_DEVELOPMENT_AND_PROVENANCE');
    const run = await client.query<{ id: string }>(
      'INSERT INTO import_runs(source_id,dataset_url,dataset_version,file_sha256) VALUES($1,$2,$3,$4) RETURNING id',
      [source.id, dataset.datasetUrl, dataset.datasetVersion, fileHash],
    );
    report.runId = run.rows[0].id;
    if (options.researchOnly)
      await importResearchBatch(
        client,
        dataset.records.map((record) => importRecordSchema.parse(record)),
        source.id,
        report,
      );
    const seen = new Map<string, string>();
    for (const [index, raw] of (options.researchOnly
      ? []
      : dataset.records
    ).entries()) {
      const parsed = importRecordSchema.safeParse(raw);
      if (!parsed.success) {
        report.failed++;
        report.failures.push({
          index,
          code: 'INVALID_RECORD',
          fields: [
            ...new Set(
              parsed.error.issues.map((issue) => issue.path.join('.')),
            ),
          ],
        });
        continue;
      }
      const record = parsed.data;
      const identity = recordIdentity(record),
        hash = contentHash(record);
      const prior = seen.get(identity);
      if (prior) {
        if (prior === hash) report.duplicated++;
        else {
          report.failed++;
          report.failures.push({ index, code: 'CONFLICTING_DUPLICATE' });
        }
        continue;
      }
      seen.set(identity, hash);
      await client.query('SAVEPOINT import_record');
      try {
        // Do not silently change collection metadata or human-owned topic/verification metadata.
        const collection = await client.query<{ id: string }>(
          `INSERT INTO hadith_collections(slug,name,original_name)
          VALUES($1,$2,$3) ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug
          WHERE hadith_collections.name=EXCLUDED.name AND
            hadith_collections.original_name IS NOT DISTINCT FROM EXCLUDED.original_name RETURNING id`,
          [
            record.collection.slug,
            record.collection.name,
            record.collection.originalName ?? null,
          ],
        );
        const collectionId = collection.rows[0]?.id;
        if (!collectionId) throw new Error('COLLECTION_METADATA_CONFLICT');
        const existing = await client.query<{
          id: string;
          content_hash: string;
        }>(
          'SELECT id,content_hash FROM hadiths WHERE source_id=$1 AND collection_id=$2 AND numbering_scheme=$3 AND hadith_number=$4 FOR UPDATE',
          [
            source.id,
            collectionId,
            record.numberingScheme,
            record.hadithNumber,
          ],
        );
        if (existing.rows[0]?.content_hash === hash) {
          report.skipped++;
        } else {
          await client.query(
            `INSERT INTO hadiths(source_id,collection_id,numbering_scheme,hadith_number,
            book_name,chapter_name,narrator,arabic_text,indonesian_text,normalized_translation,
            translation_attribution,reference_url,grading_text,grading_attribution,grading_source_url,
            content_hash,import_run_id,raw_record)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
            ON CONFLICT(source_id,collection_id,numbering_scheme,hadith_number) DO UPDATE SET
            book_name=EXCLUDED.book_name,chapter_name=EXCLUDED.chapter_name,narrator=EXCLUDED.narrator,
            arabic_text=EXCLUDED.arabic_text,indonesian_text=EXCLUDED.indonesian_text,
            normalized_translation=EXCLUDED.normalized_translation,translation_attribution=EXCLUDED.translation_attribution,
            reference_url=EXCLUDED.reference_url,grading_text=EXCLUDED.grading_text,
            grading_attribution=EXCLUDED.grading_attribution,grading_source_url=EXCLUDED.grading_source_url,
            content_hash=EXCLUDED.content_hash,import_run_id=EXCLUDED.import_run_id,raw_record=EXCLUDED.raw_record,
            verification_status='draft',verified_by=NULL,verified_at=NULL,verification_reference_url=NULL`,
            [
              source.id,
              collectionId,
              record.numberingScheme,
              record.hadithNumber,
              record.bookName,
              record.chapterName ?? null,
              record.narrator ?? null,
              record.arabicText,
              record.indonesianText,
              normalizeIndexText(record.indonesianText),
              record.translationAttribution,
              record.referenceUrl,
              record.grade?.text ?? null,
              record.grade?.grader ?? null,
              record.grade?.sourceUrl ?? null,
              hash,
              report.runId,
              JSON.stringify(record),
            ],
          );
          if (existing.rows.length) report.updated++;
          else report.imported++;
        }
        await client.query('RELEASE SAVEPOINT import_record');
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT import_record');
        await client.query('RELEASE SAVEPOINT import_record');
        report.failed++;
        report.failures.push({ index, code: 'RECORD_DATABASE_ERROR' });
      }
    }
    report.committed = !report.dryRun;
    await client.query('UPDATE import_runs SET report=$1::jsonb WHERE id=$2', [
      JSON.stringify(report),
      report.runId,
    ]);
    await client.query(report.dryRun ? 'ROLLBACK' : 'COMMIT');
    return report;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// Validated research pilots are atomic batches. Avoid thousands of remote roundtrips;
// publication imports retain their per-record savepoint/report behavior above.
async function importResearchBatch(
  client: PoolClient,
  records: ImportRecord[],
  sourceId: string,
  report: ImportReport,
) {
  if (new Set(records.map(recordIdentity)).size !== records.length)
    throw new Error('RESEARCH_DUPLICATE_IDENTITY');
  const collections = await client.query<{ id: string; slug: string }>(
    `INSERT INTO hadith_collections(slug,name,original_name)
    SELECT DISTINCT slug,name,original_name FROM jsonb_to_recordset($1::jsonb) AS x(slug text,name text,original_name text)
    ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug WHERE hadith_collections.name=EXCLUDED.name
    AND hadith_collections.original_name IS NOT DISTINCT FROM EXCLUDED.original_name RETURNING id,slug`,
    [
      JSON.stringify(
        records.map((r) => ({
          slug: r.collection.slug,
          name: r.collection.name,
          original_name: r.collection.originalName ?? null,
        })),
      ),
    ],
  );
  const collectionId = new Map(
    collections.rows.map((row) => [row.slug, row.id]),
  );
  if (records.some((r) => !collectionId.has(r.collection.slug)))
    throw new Error('COLLECTION_METADATA_CONFLICT');
  const existing = await client.query<{
    collection_id: string;
    numbering_scheme: string;
    hadith_number: string;
    content_hash: string;
  }>(
    'SELECT collection_id,numbering_scheme,hadith_number,content_hash FROM hadiths WHERE source_id=$1',
    [sourceId],
  );
  const key = (collection: string, scheme: string, number: string) =>
    JSON.stringify([collection, scheme, number]);
  const prior = new Map(
    existing.rows.map((row) => [
      key(row.collection_id, row.numbering_scheme, row.hadith_number),
      row.content_hash,
    ]),
  );
  const changed = [];
  for (const record of records) {
    const hash = contentHash(record),
      cid = collectionId.get(record.collection.slug)!;
    const previous = prior.get(
      key(cid, record.numberingScheme, record.hadithNumber),
    );
    if (previous === hash) {
      report.skipped++;
      continue;
    }
    if (previous) report.updated++;
    else report.imported++;
    changed.push({
      collection_id: cid,
      numbering_scheme: record.numberingScheme,
      hadith_number: record.hadithNumber,
      book_name: record.bookName,
      chapter_name: record.chapterName ?? null,
      narrator: record.narrator ?? null,
      arabic_text: record.arabicText,
      indonesian_text: record.indonesianText,
      normalized_translation: normalizeIndexText(record.indonesianText),
      translation_attribution: record.translationAttribution,
      reference_url: record.referenceUrl,
      grading_text: record.grade?.text ?? null,
      grading_attribution: record.grade?.grader ?? null,
      grading_source_url: record.grade?.sourceUrl ?? null,
      content_hash: hash,
      raw_record: record,
    });
  }
  if (changed.length)
    await client.query(
      `INSERT INTO hadiths(source_id,import_run_id,collection_id,numbering_scheme,hadith_number,
    book_name,chapter_name,narrator,arabic_text,indonesian_text,normalized_translation,translation_attribution,reference_url,
    grading_text,grading_attribution,grading_source_url,content_hash,raw_record)
    SELECT $1::uuid,$2::uuid,collection_id,numbering_scheme,hadith_number,book_name,chapter_name,narrator,arabic_text,indonesian_text,
    normalized_translation,translation_attribution,reference_url,grading_text,grading_attribution,grading_source_url,content_hash,raw_record
    FROM jsonb_to_recordset($3::jsonb) AS x(collection_id uuid,numbering_scheme text,hadith_number text,book_name text,chapter_name text,narrator text,
    arabic_text text,indonesian_text text,normalized_translation text,translation_attribution text,reference_url text,
    grading_text text,grading_attribution text,grading_source_url text,content_hash text,raw_record jsonb)
    ON CONFLICT(source_id,collection_id,numbering_scheme,hadith_number) DO UPDATE SET book_name=EXCLUDED.book_name,chapter_name=EXCLUDED.chapter_name,
    narrator=EXCLUDED.narrator,arabic_text=EXCLUDED.arabic_text,indonesian_text=EXCLUDED.indonesian_text,normalized_translation=EXCLUDED.normalized_translation,
    translation_attribution=EXCLUDED.translation_attribution,reference_url=EXCLUDED.reference_url,grading_text=EXCLUDED.grading_text,
    grading_attribution=EXCLUDED.grading_attribution,grading_source_url=EXCLUDED.grading_source_url,content_hash=EXCLUDED.content_hash,
    import_run_id=EXCLUDED.import_run_id,raw_record=EXCLUDED.raw_record,verification_status='draft',verified_by=NULL,verified_at=NULL,verification_reference_url=NULL`,
      [sourceId, report.runId, JSON.stringify(changed)],
    );
}
