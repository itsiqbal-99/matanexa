import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  datasetSchema,
  importRecordSchema,
  type ImportRecord,
} from './importer';
export const PILOT_REVISION = 'df57907be35291c91ad6a6691180e22ca9920784';
export const PILOT_SOURCE = 'fawaz-bukhari-local';
export const PILOT_REPOSITORY = 'https://github.com/fawazahmed0/hadith-api';
export const editionUrl = (edition: string) =>
  `https://raw.githubusercontent.com/fawazahmed0/hadith-api/${PILOT_REVISION}/editions/${edition}.json`;
export const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const entry = z.object({
  hadithnumber: z.union([z.number(), z.string()]),
  arabicnumber: z.union([z.number(), z.string()]),
  text: z.string().nullable(),
  reference: z.object({
    book: z.number().int().nonnegative(),
    hadith: z.number().int().nonnegative(),
  }),
});
const edition = z.object({
  metadata: z.object({
    name: z.literal('Sahih al Bukhari'),
    sections: z.record(z.string(), z.string()),
  }),
  hadiths: z.array(entry),
});
export function preparePilot(arabicRaw: string, indonesianRaw: string) {
  const ar = edition.parse(JSON.parse(arabicRaw) as unknown),
    id = edition.parse(JSON.parse(indonesianRaw) as unknown);
  const arabicFileSha256 = sha256(arabicRaw),
    indonesianFileSha256 = sha256(indonesianRaw);
  const index = (rows: z.infer<typeof entry>[]) => {
    const map = new Map<string, z.infer<typeof entry>[]>();
    for (const row of rows) {
      const key = String(row.hadithnumber);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  };
  const arabic = index(ar.hadiths),
    indonesian = index(id.hadiths);
  const selected = [
    ...new Set(
      [
        ...id.hadiths.filter((h) => [70, 78].includes(h.reference.book)),
        ...id.hadiths.filter((h) => h.reference.book === 1),
        ...id.hadiths.filter((h) => h.reference.book === 3).slice(0, 40),
        ...id.hadiths.filter((h) => h.reference.book === 24).slice(0, 25),
      ].map((h) => String(h.hadithnumber)),
    ),
  ];
  const rejected: { number: string; reason: string }[] = [],
    records: ImportRecord[] = [];
  for (const number of selected) {
    const aa = arabic.get(number),
      ii = indonesian.get(number);
    let reason = '';
    if (aa?.length !== 1 || ii?.length !== 1)
      reason = 'MISSING_OR_AMBIGUOUS_IDENTITY';
    else if (
      !aa[0].text?.trim() ||
      !ii[0].text?.trim() ||
      !/[\u0600-\u06ff]/.test(aa[0].text) ||
      !/[a-zA-Z]/.test(ii[0].text)
    )
      reason = 'EMPTY_OR_INVALID_LANGUAGE_TEXT';
    else if (
      aa[0].reference.book < 1 ||
      aa[0].reference.hadith < 1 ||
      ii[0].reference.hadith < 1 ||
      aa[0].reference.book !== ii[0].reference.book ||
      aa[0].reference.hadith !== ii[0].reference.hadith ||
      String(aa[0].arabicnumber) !== String(ii[0].arabicnumber) ||
      ar.metadata.sections[String(aa[0].reference.book)] !==
        id.metadata.sections[String(ii[0].reference.book)]
    )
      reason = 'REFERENCE_METADATA_MISMATCH';
    if (reason) {
      rejected.push({ number, reason });
      continue;
    }
    const a = aa![0],
      i = ii![0];
    records.push(
      importRecordSchema.parse({
        collection: { slug: 'bukhari', name: 'Sahih al Bukhari' },
        hadithNumber: number,
        numberingScheme: 'fawazahmed0/bukhari hadithnumber (revision pinned)',
        bookName: id.metadata.sections[String(i.reference.book)],
        arabicText: a.text,
        indonesianText: i.text,
        translationAttribution:
          'ind-bukhari — fawazahmed0/hadith-api; research_only; upstream translation rights unresolved',
        referenceUrl: `https://github.com/fawazahmed0/hadith-api/blob/${PILOT_REVISION}/editions/ind-bukhari/${number}.json`,
        provenance: {
          repository: PILOT_REPOSITORY,
          revision: PILOT_REVISION,
          arabicEdition: 'ara-bukhari',
          indonesianEdition: 'ind-bukhari',
          arabicUrl: editionUrl('ara-bukhari'),
          indonesianUrl: editionUrl('ind-bukhari'),
          arabicFileSha256,
          indonesianFileSha256,
          sourceBook: i.reference.book,
          sourceHadith: i.reference.hadith,
          pairingStatus: 'identity_matched',
          humanReview: 'pending',
        },
      }),
    );
  }
  for (const required of ['1', '5376', '5971', '6116'])
    if (!records.some((r) => r.hadithNumber === required))
      throw new Error('REQUIRED_PILOT_ANCHOR_REJECTED');
  if (records.length < 300 || records.length > 500)
    throw new Error('PILOT_SIZE_OUT_OF_BOUNDS');
  return {
    dataset: datasetSchema.parse({
      sourceSlug: PILOT_SOURCE,
      datasetVersion: PILOT_REVISION,
      datasetUrl: editionUrl('ind-bukhari'),
      records,
    }),
    report: {
      scope: 'research_only',
      revision: PILOT_REVISION,
      selected: selected.length,
      accepted: records.length,
      rejected,
      arabicSha256: arabicFileSha256,
      indonesianSha256: indonesianFileSha256,
      humanReview: 'pending',
      gradeImported: false,
    },
  };
}
