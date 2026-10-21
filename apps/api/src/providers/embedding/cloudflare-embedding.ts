import { Inject, Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import {
  abortError,
  createAbortBudget,
  type ProviderCallOptions,
} from '../provider-contract';
import {
  ACTIVE_EMBEDDING_DIMENSIONS,
  ACTIVE_EMBEDDING_MODEL,
  type EmbeddingModelDescriptor,
  EmbeddingProviderError,
  type EmbeddingProvider,
} from './embedding-provider';

export const EMBEDDING_MODEL = ACTIVE_EMBEDDING_MODEL;
export const EMBEDDING_FETCH = Symbol('EMBEDDING_FETCH');
const vector = z
  .array(z.number().finite())
  .length(ACTIVE_EMBEDDING_DIMENSIONS)
  .refine((v) => v.some((x) => x !== 0));
const responseSchema = z.object({
  success: z.literal(true),
  result: z.object({ data: z.array(vector).min(1).max(4) }),
});
export { EmbeddingProviderError as EmbeddingUnavailable };

@Injectable()
export class CloudflareEmbeddingAdapter implements EmbeddingProvider {
  readonly providerId = 'cloudflare';
  readonly descriptor: EmbeddingModelDescriptor = {
    providerId: this.providerId,
    modelId: ACTIVE_EMBEDDING_MODEL,
    dimensions: ACTIVE_EMBEDDING_DIMENSIONS,
    maxBatchSize: 4,
    maxInputCharacters: 12000,
  };
  private readonly counters = {
    requests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    submittedTexts: 0,
    submittedCharacters: 0,
    submittedBytes: 0,
    reportedInputTokens: null as number | null,
    reportedTotalTokens: null as number | null,
    reportedNeurons: null as number | null,
    usageReported: false,
  };
  get statistics() {
    return { ...this.counters };
  }
  constructor(
    @Inject(ENVIRONMENT) private readonly env: Environment,
    @Optional()
    @Inject(EMBEDDING_FETCH)
    private readonly transport?: typeof fetch,
  ) {}
  get configured() {
    return !!this.env.cloudflareAccountId && !!this.env.cloudflareApiToken;
  }
  async embed(
    texts: readonly string[],
    options?: ProviderCallOptions,
  ): Promise<number[][]> {
    if (!this.configured) throw new EmbeddingProviderError('NOT_CONFIGURED');
    if (
      !/^[a-f0-9]{32}$/i.test(this.env.cloudflareAccountId!) ||
      texts.length < 1 ||
      texts.length > this.descriptor.maxBatchSize ||
      texts.some(
        (text) =>
          !text.trim() || text.length > this.descriptor.maxInputCharacters,
      )
    )
      throw new EmbeddingProviderError('INVALID_RESPONSE');
    this.counters.requests++;
    this.counters.submittedTexts += texts.length;
    this.counters.submittedCharacters += texts.reduce(
      (sum, text) => sum + text.length,
      0,
    );
    this.counters.submittedBytes += texts.reduce(
      (sum, text) => sum + Buffer.byteLength(text, 'utf8'),
      0,
    );
    const budget = createAbortBudget(options?.signal, 4000);
    try {
      const r = await (this.transport ?? fetch)(
        `https://api.cloudflare.com/client/v4/accounts/${this.env.cloudflareAccountId!}/ai/run/${EMBEDDING_MODEL}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.cloudflareApiToken!}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: texts }),
          signal: budget.signal,
        },
      );
      if (!r.ok) throw new EmbeddingProviderError('REMOTE_ERROR', r.status);
      const raw = await r.text();
      if (raw.length > 1000000)
        throw new EmbeddingProviderError('INVALID_RESPONSE');
      const body: unknown = JSON.parse(raw);
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success || parsed.data.result.data.length !== texts.length)
        throw new EmbeddingProviderError('INVALID_RESPONSE');
      this.counters.successfulRequests++;
      // Optional provider usage is numeric-only. Never retain prompts, headers,
      // response metadata or credentials in telemetry.
      const usageSchema = z.object({
        input_tokens: z.number().nonnegative().optional(),
        total_tokens: z.number().nonnegative().optional(),
        neurons: z.number().nonnegative().optional(),
      });
      const envelope = z
        .object({
          usage: usageSchema.optional(),
          result: z.object({
            usage: usageSchema.optional(),
            meta: usageSchema.optional(),
          }),
        })
        .safeParse(body);
      if (envelope.success) {
        const usage =
          envelope.data.usage ??
          envelope.data.result.usage ??
          envelope.data.result.meta;
        if (
          usage &&
          [usage.input_tokens, usage.total_tokens, usage.neurons].some(
            (n) => n !== undefined,
          )
        ) {
          this.counters.usageReported = true;
          if (usage.input_tokens !== undefined)
            this.counters.reportedInputTokens =
              (this.counters.reportedInputTokens ?? 0) + usage.input_tokens;
          if (usage.total_tokens !== undefined)
            this.counters.reportedTotalTokens =
              (this.counters.reportedTotalTokens ?? 0) + usage.total_tokens;
          if (usage.neurons !== undefined)
            this.counters.reportedNeurons =
              (this.counters.reportedNeurons ?? 0) + usage.neurons;
        }
      }
      return parsed.data.result.data;
    } catch (error) {
      this.counters.failedRequests++;
      if (error instanceof EmbeddingProviderError) throw error;
      if (
        budget.signal.aborted ||
        (error instanceof Error &&
          ['AbortError', 'TimeoutError'].includes(error.name))
      ) {
        const normalized = abortError(
          this.providerId,
          'embed',
          options?.signal,
          budget.timedOut(),
        );
        throw new EmbeddingProviderError(
          normalized.code === 'ABORTED' ? 'ABORTED' : 'TIMEOUT',
        );
      }
      throw new EmbeddingProviderError('INVALID_RESPONSE');
    } finally {
      budget.cleanup();
    }
  }
}

export { CloudflareEmbeddingAdapter as CloudflareEmbedding };
