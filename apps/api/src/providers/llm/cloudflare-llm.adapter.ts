import { Inject, Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import {
  abortError,
  createAbortBudget,
  ProviderError,
  type AbortBudget,
  type ProviderCallOptions,
  type ProviderErrorCode,
  type ProviderUsage,
} from '../provider-contract';
import {
  PROVIDER_TELEMETRY,
  ProviderTelemetryCollector,
} from '../provider-telemetry';
import type {
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  LlmProvider,
  ModelCapabilities,
} from './llm-provider';
import { validateGenerationRequest } from './llm-provider';

export const LLM_FETCH = Symbol('LLM_FETCH');
const CLOUDFLARE_PROVIDER_ID = 'cloudflare';
const MAX_RESPONSE_BYTES = 2_000_000;
const VERIFIED_STREAMING_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

const usageSchema = z
  .object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const responseSchema = z
  .object({
    success: z.literal(true),
    result: z
      .object({
        response: z.string(),
        usage: usageSchema.optional(),
        finish_reason: z.string().optional(),
        tool_calls: z.array(z.unknown()).optional(),
        request_id: z.string().max(256).optional(),
      })
      .passthrough(),
  })
  .passthrough();

function normalizeUsage(
  usage: z.infer<typeof usageSchema> | undefined,
): ProviderUsage | undefined {
  if (!usage) return undefined;
  const normalized = {
    ...(usage.input_tokens !== undefined
      ? { inputTokens: usage.input_tokens }
      : {}),
    ...(usage.output_tokens !== undefined
      ? { outputTokens: usage.output_tokens }
      : {}),
    ...(usage.total_tokens !== undefined
      ? { totalTokens: usage.total_tokens }
      : {}),
  };
  return Object.keys(normalized).length ? normalized : undefined;
}

function finishReason(
  value: string | undefined,
): GenerationResponse['finishReason'] {
  if (value === 'stop') return 'stop';
  if (value === 'length') return 'length';
  if (value === 'tool_call' || value === 'tool_calls') return 'tool_call';
  return 'unknown';
}

@Injectable()
export class CloudflareLlmAdapter implements LlmProvider {
  readonly providerId = CLOUDFLARE_PROVIDER_ID;

  constructor(
    @Inject(ENVIRONMENT) private readonly env: Environment,
    @Optional() @Inject(LLM_FETCH) private readonly transport?: typeof fetch,
    @Optional()
    @Inject(PROVIDER_TELEMETRY)
    private readonly telemetry = new ProviderTelemetryCollector(),
  ) {}

  get configured(): boolean {
    return (
      this.env.llmProvider === 'cloudflare' &&
      !!this.env.cloudflareAccountId &&
      !!this.env.cloudflareApiToken &&
      !!this.env.llmModel
    );
  }

  capabilities(modelId: string): ModelCapabilities {
    const streaming =
      modelId === VERIFIED_STREAMING_MODEL
        ? ('native' as const)
        : ('none' as const);
    return {
      providerId: this.providerId,
      modelId,
      contextWindow: modelId === VERIFIED_STREAMING_MODEL ? 32000 : null,
      maxOutputTokens: 4096,
      streaming,
      toolCalling: 'none',
      structuredOutput: 'none',
      usage: ['input_tokens', 'output_tokens', 'total_tokens'],
      timeoutMs: this.env.llmTimeoutMs,
      maxConcurrency: this.env.llmMaxConcurrency,
      evidence: {
        source:
          modelId === VERIFIED_STREAMING_MODEL
            ? 'https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/'
            : 'unverified-model-capabilities',
        checkedAt: '2026-10-21',
      },
    };
  }

  async generate(
    request: GenerationRequest,
    options?: ProviderCallOptions,
  ): Promise<GenerationResponse> {
    const startedAt = new Date();
    const started = Date.now();
    let budget: AbortBudget | undefined;
    try {
      const capabilities = this.prepare(request, 'generate');
      budget = createAbortBudget(options?.signal, capabilities.timeoutMs);
      const response = await this.call(request, false, budget.signal);
      const raw = await response.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES)
        throw this.error('INVALID_RESPONSE', 'generate');
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw this.error('INVALID_RESPONSE', 'generate');
      }
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success || (parsed.data.result.tool_calls?.length ?? 0) > 0)
        throw this.error('INVALID_RESPONSE', 'generate');
      const usage = normalizeUsage(parsed.data.result.usage);
      const result: GenerationResponse = {
        providerId: this.providerId,
        modelId: request.modelId,
        text: parsed.data.result.response,
        finishReason: finishReason(parsed.data.result.finish_reason),
        ...(usage ? { usage } : {}),
        ...(parsed.data.result.request_id
          ? { providerRequestId: parsed.data.result.request_id }
          : {}),
      };
      this.record(request, 'generate', startedAt, started, 'success', usage);
      return result;
    } catch (error) {
      const normalized = this.normalizeFailure(
        error,
        'generate',
        options?.signal,
        budget?.timedOut() ?? false,
      );
      this.record(
        request,
        'generate',
        startedAt,
        started,
        normalized.code === 'ABORTED' ? 'aborted' : 'error',
        undefined,
        normalized.code,
      );
      throw normalized;
    } finally {
      budget?.cleanup();
    }
  }

  async *stream(
    request: GenerationRequest,
    options?: ProviderCallOptions,
  ): AsyncIterable<GenerationEvent> {
    const startedAt = new Date();
    const started = Date.now();
    let budget: AbortBudget | undefined;
    let firstEventMs: number | undefined;
    let usage: ProviderUsage | undefined;
    try {
      const capabilities = this.prepare(request, 'stream');
      budget = createAbortBudget(options?.signal, capabilities.timeoutMs);
      const response = await this.call(request, true, budget.signal);
      if (!response.body) throw this.error('INVALID_RESPONSE', 'stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedBytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const value = chunk.value as Uint8Array;
        receivedBytes += value.byteLength;
        if (receivedBytes > MAX_RESPONSE_BYTES)
          throw this.error('INVALID_RESPONSE', 'stream');
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/gu);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const event = this.parseStreamLine(line);
          if (!event) continue;
          firstEventMs ??= Date.now() - started;
          if (event.type === 'usage') usage = event.usage;
          yield event;
        }
      }
      if (buffer.trim()) {
        const event = this.parseStreamLine(buffer);
        if (event) yield event;
      }
      yield { type: 'done', finishReason: 'stop' };
      this.record(
        request,
        'stream',
        startedAt,
        started,
        'success',
        usage,
        undefined,
        firstEventMs,
      );
    } catch (error) {
      const normalized = this.normalizeFailure(
        error,
        'stream',
        options?.signal,
        budget?.timedOut() ?? false,
      );
      this.record(
        request,
        'stream',
        startedAt,
        started,
        normalized.code === 'ABORTED' ? 'aborted' : 'error',
        undefined,
        normalized.code,
        firstEventMs,
      );
      throw normalized;
    } finally {
      budget?.cleanup();
    }
  }

  private prepare(
    request: GenerationRequest,
    operation: 'generate' | 'stream',
  ): ModelCapabilities {
    if (!this.configured) throw this.error('NOT_CONFIGURED', operation);
    if (
      request.modelId !== this.env.llmModel ||
      !/^[a-f0-9]{32}$/i.test(this.env.cloudflareAccountId!) ||
      !/^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(request.modelId) ||
      request.modelId.includes('..')
    )
      throw this.error('POLICY_REJECTED', operation);
    const capabilities = this.capabilities(request.modelId);
    validateGenerationRequest(capabilities, request, operation);
    return capabilities;
  }

  private async call(
    request: GenerationRequest,
    stream: boolean,
    signal: AbortSignal,
  ): Promise<Response> {
    const response = await (this.transport ?? fetch)(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.cloudflareAccountId!}/ai/run/${request.modelId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.cloudflareApiToken!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: request.messages.map(({ role, content }) => ({
            role,
            content,
          })),
          max_tokens: request.maxOutputTokens,
          ...(request.temperature !== undefined
            ? { temperature: request.temperature }
            : {}),
          ...(stream ? { stream: true } : {}),
        }),
        signal,
      },
    );
    if (!response.ok)
      throw this.error(
        this.statusCode(response.status),
        stream ? 'stream' : 'generate',
        response.status,
      );
    return response;
  }

  private parseStreamLine(line: string): GenerationEvent | undefined {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return undefined;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return undefined;
    let value: unknown;
    try {
      value = JSON.parse(data);
    } catch {
      throw this.error('INVALID_RESPONSE', 'stream');
    }
    const parsed = z
      .object({
        response: z.string().optional(),
        delta: z.string().optional(),
        usage: usageSchema.optional(),
      })
      .passthrough()
      .safeParse(value);
    if (!parsed.success) throw this.error('INVALID_RESPONSE', 'stream');
    const text = parsed.data.response ?? parsed.data.delta;
    if (text !== undefined) return { type: 'text_delta', text };
    const usage = normalizeUsage(parsed.data.usage);
    return usage ? { type: 'usage', usage } : undefined;
  }

  private statusCode(status: number): ProviderErrorCode {
    if (status === 401 || status === 403) return 'AUTHENTICATION_FAILED';
    if (status === 429) return 'RATE_LIMITED';
    if (status === 408 || status === 504) return 'TIMEOUT';
    if (status >= 500) return 'UNAVAILABLE';
    if (status === 400 || status === 422) return 'POLICY_REJECTED';
    return 'INVALID_RESPONSE';
  }

  private error(
    code: ProviderErrorCode,
    operation: 'generate' | 'stream',
    httpStatus?: number,
  ): ProviderError {
    return new ProviderError(code, {
      providerId: this.providerId,
      operation,
      retryable: ['RATE_LIMITED', 'TIMEOUT', 'UNAVAILABLE'].includes(code),
      ...(httpStatus === undefined ? {} : { httpStatus }),
    });
  }

  private normalizeFailure(
    error: unknown,
    operation: 'generate' | 'stream',
    callerSignal: AbortSignal | undefined,
    timedOut: boolean,
  ): ProviderError {
    if (error instanceof ProviderError) return error;
    if (
      timedOut ||
      callerSignal?.aborted ||
      (error instanceof Error &&
        ['AbortError', 'TimeoutError'].includes(error.name))
    )
      return abortError(this.providerId, operation, callerSignal, timedOut);
    return this.error('UNAVAILABLE', operation);
  }

  private record(
    request: GenerationRequest,
    operation: 'generate' | 'stream',
    startedAt: Date,
    started: number,
    outcome: 'success' | 'error' | 'aborted',
    usage?: ProviderUsage,
    errorCode?: ProviderErrorCode,
    firstEventMs?: number,
  ): void {
    this.telemetry.record({
      ...(request.correlationId
        ? { correlationId: request.correlationId }
        : {}),
      providerId: this.providerId,
      modelId: request.modelId,
      operation,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - started,
      outcome,
      ...(usage ? { usage } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(firstEventMs === undefined ? {} : { firstEventMs }),
    });
  }
}
