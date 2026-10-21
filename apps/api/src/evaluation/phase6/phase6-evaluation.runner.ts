import {
  conversationTurnResultSchema,
  type ConversationContext,
} from '@matanexa/contracts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Environment } from '../../config/environment';
import { ConversationOrchestrationError } from '../../modules/conversations/conversation.error';
import { ConversationOrchestratorService } from '../../modules/conversations/conversation-orchestrator.service';
import { ConversationTelemetryCollector } from '../../modules/conversations/conversation-telemetry';
import type {
  RetrievalGateway,
  RetrievalPage,
  RetrievalRecord,
} from '../../modules/retrieval/retrieval.gateway';
import { RetrievalToolExecutor } from '../../modules/retrieval/retrieval-tool.executor';
import { DisabledLlmProvider } from '../../providers/llm/disabled-llm.provider';
import type {
  GenerationRequest,
  GenerationResponse,
  LlmProvider,
  ModelCapabilities,
} from '../../providers/llm/llm-provider';
import { ProviderError } from '../../providers/provider-contract';
import type { ProviderCallOptions } from '../../providers/provider-contract';
import {
  phase6EvaluationDatasetSchema,
  type Phase6CaseResult,
  type Phase6EvaluationCase,
  type Phase6EvaluationDataset,
  type Phase6EvaluationReport,
} from './phase6-evaluation.types';

const MODEL_ID = 'phase6-offline-deterministic-v1';
const PRIMARY_ID = '11111111-1111-4111-8111-111111111111';
const SECONDARY_ID = '22222222-2222-4222-8222-222222222222';
const RESEARCH_ID = '33333333-3333-4333-8333-333333333333';
const INVENTED_CITATION = 'cite_99999999-9999-4999-8999-999999999999';

const datasetDefaultPath = resolve(
  process.cwd(),
  'evaluation',
  'phase6-offline-cases.json',
);

function record(
  id: string,
  overrides: Partial<RetrievalRecord> = {},
): RetrievalRecord {
  const sequence = id === PRIMARY_ID ? '1' : id === SECONDARY_ID ? '2' : '3';
  return {
    id,
    title: `FIXTURE ${sequence} — BUKAN HADITS`,
    excerpt: `PLACEHOLDER TERJEMAHAN ${sequence} — BUKAN HADITS.`,
    citation: {
      collection: 'KOLEKSI FIXTURE — BUKAN SUMBER',
      number: sequence,
      numberingScheme: 'fixture-only-v1',
    },
    collection: 'KOLEKSI FIXTURE — BUKAN SUMBER',
    sourceSlug: 'phase6-fixture-only',
    hadithNumber: sequence,
    numberingScheme: 'fixture-only-v1',
    bookName: 'BUKU FIXTURE — BUKAN SUMBER',
    chapterName: 'BAB FIXTURE',
    narrator: 'NARATOR FIXTURE',
    arabicText: `PLACEHOLDER_ARABIC_${sequence}_NOT_HADITH`,
    translation: `PLACEHOLDER TERJEMAHAN ${sequence} — BUKAN HADITS.`,
    indonesianText: `PLACEHOLDER TERJEMAHAN ${sequence} — BUKAN HADITS.`,
    translationAttribution: 'ATRIBUSI FIXTURE',
    grade: null,
    grader: null,
    gradingSourceUrl: null,
    sourceUrl: 'https://example.invalid/phase6/source',
    referenceUrl: `https://example.invalid/phase6/reference/${sequence}`,
    isVerified: true,
    verificationReferenceUrl: `https://example.invalid/phase6/verification/${sequence}`,
    topics: ['fixture-only'],
    provenance: {
      sourceName: 'SUMBER FIXTURE — BUKAN SUMBER HADITS',
      attribution: 'DATA DETERMINISTIK UNTUK UJI PIPELINE',
      licenseName: 'FIXTURE ONLY',
      licenseUrl: 'https://example.invalid/phase6/license',
    },
    ...overrides,
  } as RetrievalRecord;
}

const records = {
  eligible_primary: record(PRIMARY_ID),
  eligible_secondary: record(SECONDARY_ID),
  research_only: record(RESEARCH_ID, {
    isVerified: false,
    isResearchOnly: true,
    verificationReferenceUrl: null,
  }),
};

class EvaluationGateway implements RetrievalGateway {
  readonly searchedQueries: string[] = [];
  readonly retrievedRecordIds: string[] = [];
  retrievalLatencyMs = 0;

  constructor(private readonly scenario: Phase6EvaluationCase['simulation']) {}

  search(
    input: Parameters<RetrievalGateway['search']>[0],
  ): Promise<RetrievalPage> {
    const started = performance.now();
    this.searchedQueries.push(input.query);
    const selected =
      this.scenario.retrieval === 'empty'
        ? []
        : [records[this.scenario.retrieval]];
    this.retrievedRecordIds.push(...selected.map((item) => item.id));
    this.retrievalLatencyMs += performance.now() - started;
    return Promise.resolve({
      records: selected,
      totalCandidates: selected.length,
      modeUsed: 'lexical',
    });
  }

  findById(id: string): Promise<RetrievalRecord | undefined> {
    const started = performance.now();
    const found = Object.values(records).find((item) => item.id === id);
    this.retrievalLatencyMs += performance.now() - started;
    return Promise.resolve(found);
  }
}

class EvaluationLlmProvider implements LlmProvider {
  readonly providerId = 'phase6-offline-mock';
  readonly requests: GenerationRequest[] = [];

  constructor(private readonly scenario: Phase6EvaluationCase['simulation']) {}

  capabilities(modelId: string): ModelCapabilities {
    return {
      providerId: this.providerId,
      modelId,
      contextWindow: 4096,
      maxOutputTokens: 512,
      streaming: 'none',
      toolCalling: 'none',
      structuredOutput: 'json_object',
      usage: ['input_tokens', 'output_tokens', 'total_tokens'],
      timeoutMs: this.scenario.provider === 'timeout' ? 10 : 1000,
      maxConcurrency: 1,
      evidence: {
        source: 'deterministic-phase6-pipeline-fixture',
        checkedAt: '2026-10-21',
      },
    };
  }

  async generate(
    request: GenerationRequest,
    options: ProviderCallOptions = {},
  ): Promise<GenerationResponse> {
    this.requests.push(structuredClone(request));
    if (this.scenario.provider === 'timeout')
      return new Promise((_resolve, reject) => {
        const timer = setTimeout(() => rejectTimeout(), 50);
        const rejectTimeout = () => {
          clearTimeout(timer);
          reject(
            new ProviderError('TIMEOUT', {
              providerId: this.providerId,
              operation: 'generate',
              retryable: true,
            }),
          );
        };
        if (options.signal?.aborted) rejectTimeout();
        else
          options.signal?.addEventListener('abort', rejectTimeout, {
            once: true,
          });
      });

    const evidenceMessage = request.messages.find(
      (message) =>
        message.role === 'system' &&
        message.content.startsWith('VALIDATED_EVIDENCE_JSON:'),
    );
    if (!evidenceMessage)
      return this.response(this.scenario.reformulatedQuery ?? 'fixture query');

    if (this.scenario.provider === 'invalid_output')
      return this.response('NOT_JSON_OFFLINE_FIXTURE');
    if (this.scenario.provider === 'invalid_citation')
      return this.response(
        JSON.stringify({
          answer: 'Jawaban fixture dengan citation buatan.',
          citationIds: [INVENTED_CITATION],
        }),
      );

    const evidence = JSON.parse(
      evidenceMessage.content.slice('VALIDATED_EVIDENCE_JSON:'.length),
    ) as Array<{
      citationId: string;
      exactText: { arabic: string; indonesian: string };
    }>;
    if (this.scenario.provider === 'exact_text_copy')
      return this.response(
        JSON.stringify({
          answer: evidence[0]?.exactText.indonesian,
          citationIds: evidence.slice(0, 1).map((item) => item.citationId),
        }),
      );
    if (this.scenario.provider === 'status_overclaim')
      return this.response(
        JSON.stringify({
          answer: 'Hadits fixture ini sahih tanpa keraguan.',
          citationIds: evidence.slice(0, 1).map((item) => item.citationId),
        }),
      );
    return this.response(
      JSON.stringify({
        answer: 'RINGKASAN FIXTURE BERDASARKAN EVIDENCE DETERMINISTIK.',
        citationIds: evidence.slice(0, 1).map((item) => item.citationId),
      }),
    );
  }

  stream(): AsyncIterable<never> {
    throw new ProviderError('UNSUPPORTED_CAPABILITY', {
      providerId: this.providerId,
      operation: 'stream',
    });
  }

  private response(text: string): GenerationResponse {
    return {
      providerId: this.providerId,
      modelId: MODEL_ID,
      text,
      finishReason: 'stop',
      usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
    };
  }
}

function environment(disabled: boolean): Environment {
  return {
    runtimeEnvironment: 'test',
    port: 4000,
    mode: 'mock',
    dataScope: 'published',
    poolMax: 1,
    databaseTimeout: 1000,
    corsOrigins: ['http://localhost:3000'],
    llmProvider: disabled ? 'disabled' : 'cloudflare',
    ...(disabled ? {} : { llmModel: MODEL_ID }),
    llmTimeoutMs: 1000,
    llmMaxConcurrency: 1,
    retrievalTimeoutMs: 1000,
    retrievalMaxOutputBytes: 262144,
    orchestrationMaxContextChars: 16000,
    orchestrationMaxOutputBytes: 65536,
    orchestrationMaxToolExecutions: 4,
    orchestrationMaxOutputTokens: 512,
    internalConversationApiEnabled: false,
    conversationApiTimeoutMs: 45000,
    conversationApiMaxConcurrency: 1,
    conversationSseMaxOutputBytes: 262144,
  };
}

function context(evaluationCase: Phase6EvaluationCase): ConversationContext {
  const createdAt = '2026-10-21T00:00:00.000Z';
  return {
    version: 2,
    conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    messages: evaluationCase.messages.map((message, index) => ({
      id: `phase6-message-${index + 1}`,
      createdAt,
      ...message,
    })),
  };
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

async function evaluateCase(
  evaluationCase: Phase6EvaluationCase,
): Promise<Phase6CaseResult> {
  const gateway = new EvaluationGateway(evaluationCase.simulation);
  const disabled = evaluationCase.simulation.provider === 'disabled';
  const provider = disabled
    ? new DisabledLlmProvider()
    : new EvaluationLlmProvider(evaluationCase.simulation);
  const env = environment(disabled);
  const telemetry = new ConversationTelemetryCollector();
  const retrieval = new RetrievalToolExecutor(gateway, env);
  const orchestrator = new ConversationOrchestratorService(
    provider,
    retrieval,
    env,
    telemetry,
  );
  const started = performance.now();
  let result: Awaited<ReturnType<typeof orchestrator.execute>> | undefined;
  let errorCode: string | null = null;
  try {
    result = await orchestrator.execute(context(evaluationCase));
  } catch (error) {
    errorCode =
      error instanceof ConversationOrchestrationError
        ? error.code
        : 'UNNORMALIZED_ERROR';
  }
  const endToEndLatencyMs = performance.now() - started;
  const requests =
    provider instanceof EvaluationLlmProvider ? provider.requests : [];
  const sourceContents = evaluationCase.messages.map(
    (message) => message.content,
  );
  const firstRequestContents =
    requests[0]?.messages
      .filter(
        (message) => message.role === 'user' || message.role === 'assistant',
      )
      .map((message) => message.content) ?? [];
  const contextApplicable = requests.length > 0;
  const actualStatus = result?.execution.status ?? 'error';
  const actualFallback = result?.execution.fallbackReason ?? null;
  const actualFinalIds = result?.evidence.map((item) => item.recordId) ?? [];
  const expected = evaluationCase.expected;
  const invalidCitationExpected =
    expected.fallbackReason === 'INVALID_CITATION';
  const checks = {
    retrievalRelevance: sameValues(
      gateway.retrievedRecordIds,
      expected.retrievedRecordIds,
    ),
    contextPropagation: contextApplicable
      ? sameValues(firstRequestContents, sourceContents)
      : null,
    reformulationCorrectness:
      gateway.searchedQueries.at(-1) === expected.standaloneQuery &&
      (result?.execution.planningStrategy ?? expected.planningStrategy) ===
        expected.planningStrategy,
    evidenceEligibility:
      expected.status === 'error'
        ? errorCode === expected.errorCode
        : (result?.evidence.every(
            (item) =>
              item.eligibility.policy === 'public' &&
              item.eligibility.eligible &&
              item.status.verification === 'verified' &&
              item.status.publication === 'approved' &&
              !item.status.isResearchOnly,
          ) ?? false),
    citationValidity: invalidCitationExpected
      ? actualStatus === 'evidence_only' &&
        actualFallback === 'INVALID_CITATION'
      : actualStatus === 'grounded'
        ? sameValues(actualFinalIds, expected.finalRecordIds)
        : null,
    fallbackCorrectness:
      actualStatus === expected.status &&
      actualFallback === expected.fallbackReason,
    responseContractCompliance: result
      ? conversationTurnResultSchema.safeParse(result).success
      : errorCode !== 'UNNORMALIZED_ERROR',
    errorHandling: errorCode === expected.errorCode,
  };
  const passed = Object.values(checks).every((value) => value !== false);
  const telemetryRecord = telemetry.snapshot().at(-1);
  const usage = result?.provider.usage ?? telemetryRecord?.usage ?? null;
  return {
    caseId: evaluationCase.id,
    category: evaluationCase.category,
    passed,
    actual: {
      status: actualStatus,
      planningStrategy: result?.execution.planningStrategy ?? null,
      fallbackReason: actualFallback,
      errorCode,
      retrievedRecordIds: [...gateway.retrievedRecordIds],
      finalRecordIds: actualFinalIds,
    },
    checks,
    metrics: {
      retrievalLatencyMs: gateway.retrievalLatencyMs,
      llmLatencyMs:
        result?.provider.durationMs ?? telemetryRecord?.providerDurationMs ?? 0,
      endToEndLatencyMs,
      providerFailed:
        evaluationCase.simulation.provider === 'timeout' ||
        ['invalid_output', 'exact_text_copy', 'status_overclaim'].includes(
          evaluationCase.simulation.provider,
        ),
      fallbackUsed: actualStatus === 'evidence_only',
      citationRejected: actualFallback === 'INVALID_CITATION',
      usage,
      estimatedCostUsd: null,
    },
  };
}

export async function loadPhase6Dataset(
  datasetPath = datasetDefaultPath,
): Promise<Phase6EvaluationDataset> {
  const raw = await readFile(datasetPath, 'utf8');
  return phase6EvaluationDatasetSchema.parse(JSON.parse(raw));
}

export async function runPhase6Evaluation(
  datasetPath = datasetDefaultPath,
): Promise<Phase6EvaluationReport> {
  const dataset = await loadPhase6Dataset(datasetPath);
  const caseResults: Phase6CaseResult[] = [];
  for (const evaluationCase of dataset.cases)
    caseResults.push(await evaluateCase(evaluationCase));
  const passed = caseResults.filter((item) => item.passed).length;
  const measuredTokenUsage = caseResults.reduce(
    (total, item) => total + (item.metrics.usage?.totalTokens ?? 0),
    0,
  );
  return {
    schemaVersion: 1,
    evaluationKind: 'deterministic_pipeline_offline',
    generatedAt: new Date().toISOString(),
    datasetPath,
    fixtureNotice: dataset.fixtureNotice,
    liveInference: 'NOT_RUN',
    semanticModelQuality: 'NOT_EVALUATED',
    summary: {
      total: caseResults.length,
      passed,
      failed: caseResults.length - passed,
      passRate: caseResults.length ? passed / caseResults.length : 0,
      providerFailures: caseResults.filter(
        (item) => item.metrics.providerFailed,
      ).length,
      fallbacks: caseResults.filter((item) => item.metrics.fallbackUsed).length,
      citationRejections: caseResults.filter(
        (item) => item.metrics.citationRejected,
      ).length,
      measuredTokenUsage,
      estimatedCostUsd: null,
    },
    cases: caseResults,
  };
}

export { datasetDefaultPath };
