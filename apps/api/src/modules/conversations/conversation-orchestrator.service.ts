import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  citationIdSchema,
  conversationContextSchema,
  conversationTurnResultSchema,
  evidenceSchema,
  searchHadithToolInputSchema,
  type ConversationContext,
  type ConversationMessage,
  type ConversationPlanningStrategy,
  type ConversationTurnResult,
  type Evidence,
  type RetrievalToolName,
} from '@matanexa/contracts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import { RetrievalToolError } from '../retrieval/retrieval-tool.error';
import {
  RetrievalToolExecutor,
  type RetrievalToolSession,
} from '../retrieval/retrieval-tool.executor';
import {
  LLM_PROVIDER,
  type GenerationMessage,
  type GenerationRequest,
  type GenerationResponse,
  type LlmProvider,
  type ModelCapabilities,
  type ToolDefinition,
} from '../../providers/llm/llm-provider';
import {
  abortError,
  createAbortBudget,
  ProviderError,
  type ProviderCallOptions,
  type ProviderUsage,
} from '../../providers/provider-contract';
import { ConversationOrchestrationError } from './conversation.error';
import {
  CONVERSATION_TELEMETRY,
  ConversationTelemetryCollector,
} from './conversation-telemetry';
import { selectConversationContext } from './context-window';

const NO_EVIDENCE_MESSAGE =
  'Tidak ada evidence yang memenuhi kebijakan untuk permintaan ini.';
const EVIDENCE_ONLY_MESSAGE =
  'Jawaban AI tidak dibuat. Gunakan evidence terverifikasi yang dilampirkan.';
const MAX_EVIDENCE = 10;

const groundedDraftSchema = z
  .object({
    answer: z.string().trim().min(1).max(4000),
    citationIds: z
      .array(citationIdSchema)
      .min(1)
      .max(MAX_EVIDENCE)
      .refine((values) => new Set(values).size === values.length),
  })
  .strict();

const nativeToolDefinitions: readonly ToolDefinition[] = [
  {
    name: 'search_hadith',
    description: 'Search eligible hadith evidence for a bounded query.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 3, maxLength: 300 },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
        filters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sourceSlugs: {
              type: 'array',
              maxItems: 20,
              uniqueItems: true,
              items: { type: 'string', maxLength: 64 },
            },
          },
        },
      },
    },
  },
  {
    name: 'get_hadith_detail',
    description: 'Revalidate one stable hadith record identifier.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['recordId'],
      properties: { recordId: { type: 'string', format: 'uuid' } },
    },
  },
  {
    name: 'retrieve_related_evidence',
    description:
      'Search related evidence using an eligible seed record and a bounded query.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['recordId', 'query'],
      properties: {
        recordId: { type: 'string', format: 'uuid' },
        query: { type: 'string', minLength: 3, maxLength: 300 },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
      },
    },
  },
];

const exposedNativeTools = new Set<RetrievalToolName>(
  nativeToolDefinitions.map((tool) => tool.name as RetrievalToolName),
);

type OrchestrationOptions = ProviderCallOptions;

interface ExecutionState {
  requestId: string;
  started: number;
  providerStartedMs: number;
  generationCalls: number;
  toolExecutions: number;
  staleEvidenceCount: number;
  usage?: ProviderUsage;
  fallbackReason?: string;
  planningStrategy: ConversationPlanningStrategy;
}

interface RetrievalPlan {
  query?: string;
  evidence: Evidence[];
}

@Injectable()
export class ConversationOrchestratorService {
  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly retrievalTools: RetrievalToolExecutor,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Optional()
    @Inject(CONVERSATION_TELEMETRY)
    private readonly telemetry = new ConversationTelemetryCollector(),
  ) {}

  async execute(
    rawContext: unknown,
    options: OrchestrationOptions = {},
  ): Promise<ConversationTurnResult> {
    const parsed = conversationContextSchema.safeParse(rawContext);
    if (!parsed.success)
      throw new ConversationOrchestrationError('INVALID_CONTEXT');
    const context = parsed.data;
    const modelId = this.environment.llmModel ?? 'disabled';
    const capabilities = this.provider.capabilities(modelId);
    const contextBudget = Math.min(
      this.environment.orchestrationMaxContextChars,
      capabilities.contextWindow
        ? Math.max(2000, Math.floor(capabilities.contextWindow * 3) - 4000)
        : this.environment.orchestrationMaxContextChars,
    );
    const selected = selectConversationContext(
      context,
      Math.max(1000, Math.floor(contextBudget * 0.4)),
    );
    const session = this.retrievalTools.createSession({
      signal: options.signal,
    });
    const state: ExecutionState = {
      requestId: session.requestId,
      started: performance.now(),
      providerStartedMs: 0,
      generationCalls: 0,
      toolExecutions: 0,
      staleEvidenceCount: 0,
      planningStrategy: 'latest_user',
    };

    try {
      const latestUser = selected.messages.at(-1);
      if (!latestUser || latestUser.role !== 'user')
        throw new ConversationOrchestrationError(
          'INVALID_CONTEXT',
          state.requestId,
        );

      const providerEnabled =
        this.provider.providerId !== 'disabled' &&
        this.environment.llmProvider !== 'disabled' &&
        !!this.environment.llmModel;
      const plan = await this.planAndRetrieve(
        session,
        selected.messages,
        latestUser.content,
        capabilities,
        providerEnabled,
        state,
        options,
      );
      const evidenceByRecord = new Map(
        plan.evidence.map((evidence) => [evidence.recordId, evidence]),
      );
      await this.revalidateHistoricalEvidence(
        session,
        selected.messages,
        evidenceByRecord,
        state,
      );
      const evidence = [...evidenceByRecord.values()].slice(0, MAX_EVIDENCE);

      if (!evidence.length)
        return this.complete(
          context,
          selected.messages.length,
          selected.omittedMessageCount,
          capabilities,
          state,
          'no_evidence',
          NO_EVIDENCE_MESSAGE,
          [],
        );

      if (!providerEnabled || state.fallbackReason)
        return this.complete(
          context,
          selected.messages.length,
          selected.omittedMessageCount,
          capabilities,
          state,
          'evidence_only',
          EVIDENCE_ONLY_MESSAGE,
          evidence,
        );

      const promptEvidence = this.fitEvidenceToContext(evidence, contextBudget);
      if (!promptEvidence.length) {
        state.fallbackReason = 'EVIDENCE_CONTEXT_TOO_LARGE';
        return this.complete(
          context,
          selected.messages.length,
          selected.omittedMessageCount,
          capabilities,
          state,
          'evidence_only',
          EVIDENCE_ONLY_MESSAGE,
          evidence,
        );
      }

      let generated: GenerationResponse;
      try {
        generated = await this.callProvider(
          this.generationRequest(
            selected.messages,
            promptEvidence,
            modelId,
            capabilities,
            state.requestId,
          ),
          capabilities,
          state,
          options,
        );
      } catch (error) {
        if (this.isAbort(error))
          throw new ConversationOrchestrationError('ABORTED', state.requestId);
        state.fallbackReason = this.providerFallback(error);
        return this.complete(
          context,
          selected.messages.length,
          selected.omittedMessageCount,
          capabilities,
          state,
          'evidence_only',
          EVIDENCE_ONLY_MESSAGE,
          evidence,
        );
      }

      const draft = this.parseGroundedDraft(generated.text, promptEvidence);
      if (!draft) {
        state.fallbackReason = 'INVALID_GENERATED_OUTPUT';
        return this.complete(
          context,
          selected.messages.length,
          selected.omittedMessageCount,
          capabilities,
          state,
          'evidence_only',
          EVIDENCE_ONLY_MESSAGE,
          evidence,
        );
      }

      try {
        const validated = await this.executeTool(
          session,
          'validate_evidence_references',
          { citationIds: draft.citationIds },
          state,
        );
        const validatedEvidence = this.readEvidence(validated.data.evidence);
        if (!validatedEvidence.length) throw new Error('empty validation');
        return this.complete(
          context,
          selected.messages.length,
          selected.omittedMessageCount,
          capabilities,
          state,
          'grounded',
          draft.answer,
          validatedEvidence,
        );
      } catch (error) {
        if (this.isAbort(error))
          throw new ConversationOrchestrationError('ABORTED', state.requestId);
        state.fallbackReason = 'INVALID_CITATION';
        return this.complete(
          context,
          selected.messages.length,
          selected.omittedMessageCount,
          capabilities,
          state,
          'evidence_only',
          EVIDENCE_ONLY_MESSAGE,
          evidence,
        );
      }
    } catch (error) {
      const normalized =
        error instanceof ConversationOrchestrationError
          ? error
          : this.isAbort(error)
            ? new ConversationOrchestrationError('ABORTED', state.requestId)
            : new ConversationOrchestrationError(
                'RETRIEVAL_FAILED',
                state.requestId,
              );
      this.telemetry.record({
        requestId: state.requestId,
        providerId: this.provider.providerId,
        ...(this.environment.llmProvider !== 'disabled'
          ? { modelId: capabilities.modelId }
          : {}),
        status: normalized.code === 'ABORTED' ? 'aborted' : 'failed',
        planningStrategy: state.planningStrategy,
        durationMs: performance.now() - state.started,
        providerDurationMs: state.providerStartedMs,
        generationCalls: state.generationCalls,
        toolExecutions: state.toolExecutions,
        selectedMessageCount: selected.messages.length,
        omittedMessageCount: selected.omittedMessageCount,
        evidenceCount: 0,
        staleEvidenceCount: state.staleEvidenceCount,
        fallbackReason: normalized.code,
        ...(state.usage ? { usage: state.usage } : {}),
      });
      throw normalized;
    }
  }

  private async planAndRetrieve(
    session: RetrievalToolSession,
    messages: ConversationMessage[],
    latestQuery: string,
    capabilities: ModelCapabilities,
    providerEnabled: boolean,
    state: ExecutionState,
    options: OrchestrationOptions,
  ): Promise<RetrievalPlan> {
    if (providerEnabled && capabilities.toolCalling === 'native') {
      state.planningStrategy = 'native_tool';
      try {
        const planned = await this.callProvider(
          {
            modelId: capabilities.modelId,
            messages: [
              {
                role: 'system',
                content:
                  'Select only allowlisted retrieval tools. Never invent record IDs, citations, SQL, or source metadata.',
              },
              ...this.providerMessages(messages),
            ],
            tools: nativeToolDefinitions,
            maxOutputTokens: Math.min(
              256,
              capabilities.maxOutputTokens,
              this.environment.orchestrationMaxOutputTokens,
            ),
            temperature: 0,
            correlationId: state.requestId,
          },
          capabilities,
          state,
          options,
        );
        const evidence: Evidence[] = [];
        for (const call of planned.toolCalls ?? []) {
          if (!exposedNativeTools.has(call.name as RetrievalToolName)) continue;
          if (
            state.toolExecutions >=
            this.environment.orchestrationMaxToolExecutions - 1
          )
            break;
          const result = await this.executeTool(
            session,
            call.name as RetrievalToolName,
            call.arguments,
            state,
          );
          evidence.push(...this.readEvidence(result.data.evidence));
        }
        if (evidence.length) return { evidence };
        state.fallbackReason = 'INVALID_NATIVE_TOOL_PLAN';
      } catch (error) {
        if (this.isAbort(error)) throw error;
        state.fallbackReason = this.providerFallback(error);
      }
    }

    let query = latestQuery;
    if (
      providerEnabled &&
      capabilities.toolCalling === 'none' &&
      messages.length > 1
    ) {
      state.planningStrategy = 'llm_reformulation';
      try {
        const response = await this.callProvider(
          {
            modelId: capabilities.modelId,
            messages: [
              {
                role: 'system',
                content:
                  'Rewrite the latest user message as one standalone hadith search query using the conversation context. Return only the query, never facts, citations, IDs, SQL, or commentary.',
              },
              ...this.providerMessages(messages),
            ],
            maxOutputTokens: Math.min(
              128,
              capabilities.maxOutputTokens,
              this.environment.orchestrationMaxOutputTokens,
            ),
            temperature: 0,
            correlationId: state.requestId,
          },
          capabilities,
          state,
          options,
        );
        const reformulated = searchHadithToolInputSchema.safeParse({
          query: response.text.trim(),
          limit: 5,
        });
        if (!reformulated.success) {
          state.fallbackReason = 'INVALID_REFORMULATION';
          state.planningStrategy = 'latest_user';
        } else query = reformulated.data.query;
      } catch (error) {
        if (this.isAbort(error)) throw error;
        state.fallbackReason = this.providerFallback(error);
        state.planningStrategy = 'latest_user';
      }
    }

    const result = await this.executeTool(
      session,
      'search_hadith',
      { query, limit: 5 },
      state,
    );
    return { query, evidence: this.readEvidence(result.data.evidence) };
  }

  private async revalidateHistoricalEvidence(
    session: RetrievalToolSession,
    messages: ConversationMessage[],
    evidenceByRecord: Map<string, Evidence>,
    state: ExecutionState,
  ): Promise<void> {
    const stableIds = [
      ...new Set(
        messages.flatMap((message) =>
          message.role === 'assistant' ? (message.evidenceRecordIds ?? []) : [],
        ),
      ),
    ];
    for (const recordId of stableIds) {
      if (evidenceByRecord.has(recordId)) continue;
      if (
        state.toolExecutions >=
        this.environment.orchestrationMaxToolExecutions - 1
      )
        break;
      try {
        const result = await this.executeTool(
          session,
          'get_hadith_detail',
          { recordId },
          state,
        );
        const [evidence] = this.readEvidence(result.data.evidence);
        if (evidence) evidenceByRecord.set(evidence.recordId, evidence);
        else state.staleEvidenceCount++;
      } catch (error) {
        if (this.isAbort(error)) throw error;
        state.staleEvidenceCount++;
      }
    }
  }

  private async executeTool(
    session: RetrievalToolSession,
    name: RetrievalToolName,
    input: unknown,
    state: ExecutionState,
  ) {
    if (state.toolExecutions >= this.environment.orchestrationMaxToolExecutions)
      throw new ConversationOrchestrationError('TOOL_LIMIT', state.requestId);
    state.toolExecutions++;
    return session.execute(name, input);
  }

  private readEvidence(value: unknown): Evidence[] {
    const candidates = Array.isArray(value) ? value : value ? [value] : [];
    return candidates.flatMap((candidate) => {
      const parsed = evidenceSchema.safeParse(candidate);
      return parsed.success ? [parsed.data] : [];
    });
  }

  private providerMessages(
    messages: ConversationMessage[],
  ): GenerationMessage[] {
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  private generationRequest(
    messages: ConversationMessage[],
    evidence: Evidence[],
    modelId: string,
    capabilities: ModelCapabilities,
    requestId: string,
  ): GenerationRequest {
    const responseFormat =
      capabilities.structuredOutput === 'json_schema'
        ? {
            type: 'json_schema' as const,
            name: 'grounded_answer',
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['answer', 'citationIds'],
              properties: {
                answer: { type: 'string' },
                citationIds: {
                  type: 'array',
                  uniqueItems: true,
                  items: { type: 'string' },
                },
              },
            },
          }
        : capabilities.structuredOutput === 'json_object'
          ? ({ type: 'json_object' } as const)
          : undefined;
    return {
      modelId,
      messages: [
        {
          role: 'system',
          content:
            'Answer only from the supplied evidence. Return strict JSON {"answer":string,"citationIds":string[]}. Use only supplied citationIds. Do not quote, invent, or state hadith IDs, numbers, grades, URLs, Arabic text, translations, or source metadata; those are rendered server-side.',
        },
        ...this.providerMessages(messages),
        {
          role: 'system',
          content: `VALIDATED_EVIDENCE_JSON:${JSON.stringify(evidence)}`,
        },
      ],
      maxOutputTokens: Math.min(
        this.environment.orchestrationMaxOutputTokens,
        capabilities.maxOutputTokens,
      ),
      temperature: 0,
      ...(responseFormat ? { responseFormat } : {}),
      correlationId: requestId,
    };
  }

  private parseGroundedDraft(text: string, evidence: readonly Evidence[]) {
    if (
      Buffer.byteLength(text, 'utf8') >
      this.environment.orchestrationMaxOutputBytes
    )
      return undefined;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return undefined;
    }
    const parsed = groundedDraftSchema.safeParse(raw);
    if (!parsed.success) return undefined;
    if (
      /cite_[0-9a-f-]{36}|https?:\/\/|[0-9a-f]{8}-[0-9a-f-]{27}/i.test(
        parsed.data.answer,
      )
    )
      return undefined;
    const normalizedAnswer = parsed.data.answer
      .normalize('NFKC')
      .replace(/\s+/gu, ' ')
      .trim()
      .toLocaleLowerCase('id-ID');
    const copiesServerOwnedText = evidence.some((item) =>
      [item.exactText.arabic, item.exactText.indonesian].some((exactText) => {
        const normalizedExact = exactText
          .normalize('NFKC')
          .replace(/\s+/gu, ' ')
          .trim()
          .toLocaleLowerCase('id-ID');
        return (
          normalizedExact.length >= 16 &&
          normalizedAnswer.includes(normalizedExact)
        );
      }),
    );
    if (copiesServerOwnedText) return undefined;
    if (
      /\b(?:sahih|shahih|hasan|dha[\s'-]?if|daif|palsu|maudhu|mutawatir|authentic|weak|fabricated)\b/iu.test(
        normalizedAnswer,
      )
    )
      return undefined;
    return parsed.data;
  }

  private fitEvidenceToContext(
    evidence: Evidence[],
    contextBudget: number,
  ): Evidence[] {
    const limit = Math.max(1000, Math.floor(contextBudget * 0.4));
    let used = 0;
    const selected: Evidence[] = [];
    for (const item of evidence) {
      const size = JSON.stringify(item).length;
      if (used + size > limit) continue;
      selected.push(item);
      used += size;
    }
    return selected;
  }

  private async callProvider(
    request: GenerationRequest,
    capabilities: ModelCapabilities,
    state: ExecutionState,
    options: OrchestrationOptions,
  ): Promise<GenerationResponse> {
    if (options.signal?.aborted)
      throw new ProviderError('ABORTED', {
        providerId: this.provider.providerId,
        operation: 'generate',
      });
    const timeoutMs = Math.min(
      this.environment.llmTimeoutMs,
      capabilities.timeoutMs,
    );
    const budget = createAbortBudget(options.signal, timeoutMs);
    const started = performance.now();
    state.generationCalls++;
    const aborted = new Promise<never>((_resolve, reject) => {
      budget.signal.addEventListener(
        'abort',
        () =>
          reject(
            abortError(
              this.provider.providerId,
              'generate',
              options.signal,
              budget.timedOut(),
            ),
          ),
        { once: true },
      );
    });
    try {
      const response = await Promise.race([
        this.provider.generate(request, { signal: budget.signal }),
        aborted,
      ]);
      if (
        Buffer.byteLength(response.text, 'utf8') >
        this.environment.orchestrationMaxOutputBytes
      )
        throw new ConversationOrchestrationError(
          'OUTPUT_TOO_LARGE',
          state.requestId,
        );
      state.usage = this.addUsage(state.usage, response.usage);
      return response;
    } finally {
      state.providerStartedMs += performance.now() - started;
      budget.cleanup();
    }
  }

  private addUsage(
    current: ProviderUsage | undefined,
    next: ProviderUsage | undefined,
  ): ProviderUsage | undefined {
    if (!current && !next) return undefined;
    return {
      ...((current?.inputTokens ?? 0) + (next?.inputTokens ?? 0) > 0
        ? {
            inputTokens: (current?.inputTokens ?? 0) + (next?.inputTokens ?? 0),
          }
        : {}),
      ...((current?.outputTokens ?? 0) + (next?.outputTokens ?? 0) > 0
        ? {
            outputTokens:
              (current?.outputTokens ?? 0) + (next?.outputTokens ?? 0),
          }
        : {}),
      ...((current?.totalTokens ?? 0) + (next?.totalTokens ?? 0) > 0
        ? {
            totalTokens: (current?.totalTokens ?? 0) + (next?.totalTokens ?? 0),
          }
        : {}),
    };
  }

  private complete(
    context: ConversationContext,
    selectedMessageCount: number,
    omittedMessageCount: number,
    capabilities: ModelCapabilities,
    state: ExecutionState,
    status: ConversationTurnResult['execution']['status'],
    content: string,
    evidence: Evidence[],
  ): ConversationTurnResult {
    const durationMs = performance.now() - state.started;
    const result = conversationTurnResultSchema.parse({
      version: 2,
      conversationId: context.conversationId,
      assistant: {
        id: randomUUID(),
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
        evidenceRecordIds: evidence.map((item) => item.recordId),
      },
      evidence,
      execution: {
        requestId: state.requestId,
        status,
        planningStrategy: state.planningStrategy,
        selectedMessageCount,
        omittedMessageCount,
        toolExecutions: state.toolExecutions,
        staleEvidenceCount: state.staleEvidenceCount,
        durationMs,
        ...(state.fallbackReason
          ? { fallbackReason: state.fallbackReason }
          : {}),
      },
      provider: {
        providerId: this.provider.providerId,
        modelId:
          this.environment.llmProvider === 'disabled'
            ? null
            : capabilities.modelId,
        generationCalls: state.generationCalls,
        durationMs: state.providerStartedMs,
        ...(state.usage ? { usage: state.usage } : {}),
      },
    });
    if (
      Buffer.byteLength(JSON.stringify(result), 'utf8') >
      this.environment.orchestrationMaxOutputBytes
    )
      throw new ConversationOrchestrationError(
        'OUTPUT_TOO_LARGE',
        state.requestId,
      );
    this.telemetry.record({
      requestId: state.requestId,
      providerId: this.provider.providerId,
      ...(this.environment.llmProvider !== 'disabled'
        ? { modelId: capabilities.modelId }
        : {}),
      status,
      planningStrategy: state.planningStrategy,
      durationMs,
      providerDurationMs: state.providerStartedMs,
      generationCalls: state.generationCalls,
      toolExecutions: state.toolExecutions,
      selectedMessageCount,
      omittedMessageCount,
      evidenceCount: evidence.length,
      staleEvidenceCount: state.staleEvidenceCount,
      ...(state.fallbackReason ? { fallbackReason: state.fallbackReason } : {}),
      ...(state.usage ? { usage: state.usage } : {}),
    });
    return result;
  }

  private providerFallback(error: unknown): string {
    if (error instanceof ConversationOrchestrationError) return error.code;
    if (error instanceof ProviderError) return `PROVIDER_${error.code}`;
    return 'PROVIDER_UNAVAILABLE';
  }

  private isAbort(error: unknown): boolean {
    return (
      (error instanceof ProviderError && error.code === 'ABORTED') ||
      (error instanceof RetrievalToolError && error.code === 'ABORTED') ||
      (error instanceof ConversationOrchestrationError &&
        error.code === 'ABORTED')
    );
  }
}
