import { z } from 'zod';

const evaluationMessageSchema = z.discriminatedUnion('role', [
  z
    .object({
      role: z.literal('user'),
      content: z.string().min(1).max(4000),
    })
    .strict(),
  z
    .object({
      role: z.literal('assistant'),
      content: z.string().min(1).max(4000),
      evidenceRecordIds: z.array(z.uuid()).max(10).optional(),
    })
    .strict(),
]);

export const phase6EvaluationDatasetSchema = z
  .object({
    version: z.literal(1),
    fixtureNotice: z.string().includes('BUKAN HADITS').includes('bukan bukti'),
    cases: z
      .array(
        z
          .object({
            id: z.string().regex(/^p6-[a-z0-9-]+$/),
            category: z.enum([
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
            messages: z.array(evaluationMessageSchema).min(1).max(20),
            simulation: z
              .object({
                retrieval: z.enum([
                  'eligible_primary',
                  'eligible_secondary',
                  'empty',
                  'research_only',
                ]),
                provider: z.enum([
                  'grounded',
                  'invalid_citation',
                  'invalid_output',
                  'exact_text_copy',
                  'status_overclaim',
                  'timeout',
                  'disabled',
                ]),
                reformulatedQuery: z.string().min(3).max(300).optional(),
              })
              .strict(),
            expected: z
              .object({
                standaloneQuery: z.string().min(3).max(300),
                retrievedRecordIds: z.array(z.uuid()).max(10),
                finalRecordIds: z.array(z.uuid()).max(10),
                status: z.enum([
                  'grounded',
                  'evidence_only',
                  'no_evidence',
                  'error',
                ]),
                planningStrategy: z.enum(['latest_user', 'llm_reformulation']),
                fallbackReason: z.string().min(1).max(64).nullable(),
                errorCode: z
                  .enum([
                    'INVALID_CONTEXT',
                    'ABORTED',
                    'RETRIEVAL_FAILED',
                    'TOOL_LIMIT',
                    'OUTPUT_TOO_LARGE',
                  ])
                  .nullable(),
              })
              .strict(),
          })
          .strict(),
      )
      .min(10)
      .superRefine((cases, issue) => {
        if (new Set(cases.map((item) => item.id)).size !== cases.length)
          issue.addIssue({
            code: 'custom',
            message: 'Evaluation case IDs must be unique.',
          });
        for (const [index, item] of cases.entries()) {
          if (item.messages.at(-1)?.role !== 'user')
            issue.addIssue({
              code: 'custom',
              path: [index, 'messages'],
              message: 'Latest evaluation message must be a user turn.',
            });
          if (
            item.messages.length > 1 &&
            item.simulation.provider !== 'disabled' &&
            !item.simulation.reformulatedQuery
          )
            issue.addIssue({
              code: 'custom',
              path: [index, 'simulation', 'reformulatedQuery'],
              message: 'Multi-turn provider cases require a reformulation.',
            });
        }
      }),
  })
  .strict();

export type Phase6EvaluationDataset = z.infer<
  typeof phase6EvaluationDatasetSchema
>;
export type Phase6EvaluationCase = Phase6EvaluationDataset['cases'][number];

export interface Phase6CaseChecks {
  retrievalRelevance: boolean;
  contextPropagation: boolean | null;
  reformulationCorrectness: boolean;
  evidenceEligibility: boolean;
  citationValidity: boolean | null;
  fallbackCorrectness: boolean;
  responseContractCompliance: boolean;
  errorHandling: boolean;
}

export interface Phase6CaseResult {
  caseId: string;
  category: Phase6EvaluationCase['category'];
  passed: boolean;
  actual: {
    status: string;
    planningStrategy: string | null;
    fallbackReason: string | null;
    errorCode: string | null;
    retrievedRecordIds: string[];
    finalRecordIds: string[];
  };
  checks: Phase6CaseChecks;
  metrics: {
    retrievalLatencyMs: number;
    llmLatencyMs: number;
    endToEndLatencyMs: number;
    providerFailed: boolean;
    fallbackUsed: boolean;
    citationRejected: boolean;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    } | null;
    estimatedCostUsd: null;
  };
}

export interface Phase6EvaluationReport {
  schemaVersion: 1;
  evaluationKind: 'deterministic_pipeline_offline';
  generatedAt: string;
  datasetPath: string;
  fixtureNotice: string;
  liveInference: 'NOT_RUN';
  semanticModelQuality: 'NOT_EVALUATED';
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    providerFailures: number;
    fallbacks: number;
    citationRejections: number;
    measuredTokenUsage: number;
    estimatedCostUsd: null;
  };
  cases: Phase6CaseResult[];
}
