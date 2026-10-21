import { z } from 'zod';

export function normalizeQuery(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('id');
}

export const searchRequestSchema = z
  .object({
    query: z
      .string()
      .max(2400)
      .refine((query) => {
        const length = [...normalizeQuery(query)].length;
        return length >= 3 && length <= 300;
      }),
    page: z.number().int().min(1).max(10).default(1),
    limit: z.number().int().min(1).max(20).default(10),
    filters: z
      .object({
        sourceSlugs: z
          .array(z.string().min(1).max(64))
          .max(20)
          .refine((values) => new Set(values).size === values.length)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const mockResultSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    excerpt: z.string(),
    citation: z
      .object({
        collection: z.string(),
        number: z.literal('MOCK'),
        numberingScheme: z.literal('mock'),
      })
      .strict(),
    collection: z.string(),
    sourceSlug: z.string(),
    hadithNumber: z.null(),
    arabicText: z.null(),
    translation: z.null(),
    grade: z.null(),
    sourceUrl: z.null(),
    referenceUrl: z.null(),
    isVerified: z.literal(false),
  })
  .strict();

const verifiedFields = {
  id: z.string(),
  title: z.string(),
  excerpt: z.string(),
  citation: z
    .object({
      collection: z.string(),
      number: z.string(),
      numberingScheme: z.string(),
    })
    .strict(),
  collection: z.string(),
  sourceSlug: z.string(),
  hadithNumber: z.string(),
  numberingScheme: z.string(),
  bookName: z.string(),
  chapterName: z.string().nullable(),
  narrator: z.string().nullable(),
  arabicText: z.string(),
  translation: z.string(),
  indonesianText: z.string(),
  translationAttribution: z.string(),
  grade: z.string().nullable(),
  grader: z.string().nullable(),
  gradingSourceUrl: z.string().nullable(),
  sourceUrl: z.string(),
  referenceUrl: z.string(),
  topics: z.array(z.string()).optional(),
  provenance: z
    .object({
      sourceName: z.string(),
      attribution: z.string(),
      licenseName: z.string(),
      licenseUrl: z.string(),
    })
    .strict(),
};

export const verifiedResultSchema = z
  .object({
    ...verifiedFields,
    isVerified: z.literal(true),
    verificationReferenceUrl: z.string(),
  })
  .strict();

export const researchResultSchema = z
  .object({
    ...verifiedFields,
    isVerified: z.literal(false),
    isResearchOnly: z.literal(true),
    verificationReferenceUrl: z.null(),
  })
  .strict();

export const searchResultSchema = z.union([
  mockResultSchema,
  verifiedResultSchema,
  researchResultSchema,
]);

export const searchResponseSchema = z
  .object({
    data: z
      .object({
        query: z.string(),
        results: z.array(searchResultSchema),
        totalCandidates: z.number().int().nonnegative(),
      })
      .strict(),
    meta: z
      .object({
        page: z.number().int().min(1),
        limit: z.number().int().min(1),
        hasMore: z.boolean(),
        modeUsed: z.enum(['mock', 'lexical', 'hybrid', 'lexical_fallback']),
        dataScope: z.literal('local_pilot').optional(),
        fallbackReason: z.string().optional(),
        requestId: z.uuid(),
        queryStatus: z.enum(['ready', 'ambiguous']).optional(),
      })
      .strict(),
  })
  .strict();

export type MockResult = z.infer<typeof mockResultSchema>;
export type VerifiedResult = z.infer<typeof verifiedResultSchema>;
export type ResearchResult = z.infer<typeof researchResultSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
