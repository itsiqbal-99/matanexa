import { z } from 'zod';

export const retrievalToolNames = [
  'search_hadith',
  'get_hadith_detail',
  'retrieve_related_evidence',
  'validate_evidence_references',
] as const;

export const retrievalToolNameSchema = z.enum(retrievalToolNames);
export type RetrievalToolName = z.infer<typeof retrievalToolNameSchema>;

const sourceFiltersSchema = z
  .object({
    sourceSlugs: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/))
      .max(20)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
  })
  .strict();

const retrievalQuerySchema = z.string().trim().min(3).max(300);

export const searchHadithToolInputSchema = z
  .object({
    query: retrievalQuerySchema,
    limit: z.number().int().min(1).max(10).default(5),
    filters: sourceFiltersSchema.optional(),
  })
  .strict();

export const getHadithDetailToolInputSchema = z
  .object({ recordId: z.uuid() })
  .strict();

export const retrieveRelatedEvidenceToolInputSchema = z
  .object({
    recordId: z.uuid(),
    query: retrievalQuerySchema,
    limit: z.number().int().min(1).max(10).default(5),
    filters: sourceFiltersSchema.optional(),
  })
  .strict();

export const citationIdSchema = z.string().regex(/^cite_[0-9a-f-]{36}$/);

export const validateEvidenceReferencesToolInputSchema = z
  .object({
    citationIds: z.array(citationIdSchema).min(1).max(20),
  })
  .strict();

export const retrievalToolInputSchemas = {
  search_hadith: searchHadithToolInputSchema,
  get_hadith_detail: getHadithDetailToolInputSchema,
  retrieve_related_evidence: retrieveRelatedEvidenceToolInputSchema,
  validate_evidence_references: validateEvidenceReferencesToolInputSchema,
} as const;

export type SearchHadithToolInput = z.infer<typeof searchHadithToolInputSchema>;
export type GetHadithDetailToolInput = z.infer<
  typeof getHadithDetailToolInputSchema
>;
export type RetrieveRelatedEvidenceToolInput = z.infer<
  typeof retrieveRelatedEvidenceToolInputSchema
>;
export type ValidateEvidenceReferencesToolInput = z.infer<
  typeof validateEvidenceReferencesToolInputSchema
>;

export const evidenceSchema = z
  .object({
    citationId: citationIdSchema,
    recordId: z.uuid(),
    exactText: z
      .object({ arabic: z.string().min(1), indonesian: z.string().min(1) })
      .strict(),
    reference: z
      .object({
        collection: z.string().min(1),
        hadithNumber: z.string().min(1),
        numberingScheme: z.string().min(1),
        bookName: z.string().min(1),
        chapterName: z.string().nullable(),
        narrator: z.string().nullable(),
        referenceUrl: z.url(),
        verificationReferenceUrl: z.url().nullable(),
      })
      .strict(),
    source: z
      .object({
        slug: z.string().min(1),
        name: z.string().min(1),
        sourceUrl: z.url(),
      })
      .strict(),
    provenance: z
      .object({
        attribution: z.string().min(1),
        translationAttribution: z.string().min(1),
        licenseName: z.string().min(1),
        licenseUrl: z.url(),
      })
      .strict(),
    status: z
      .object({
        verification: z.enum(['verified', 'unverified']),
        publication: z.enum(['approved', 'research_only']),
        isResearchOnly: z.boolean(),
      })
      .strict(),
    eligibility: z
      .object({
        policy: z.enum(['public', 'research']),
        eligible: z.boolean(),
        reasons: z.array(
          z.enum([
            'VERIFIED',
            'APPROVED_SOURCE',
            'RESEARCH_SCOPE_ONLY',
            'NOT_PUBLICLY_VERIFIED',
          ]),
        ),
      })
      .strict(),
  })
  .strict();

export type Evidence = z.infer<typeof evidenceSchema>;
