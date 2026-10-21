import { ProviderError } from '../provider-contract';
import type { ProviderCallOptions } from '../provider-contract';
import type {
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  LlmProvider,
  ModelCapabilities,
} from './llm-provider';
import { validateGenerationRequest } from './llm-provider';

export class MockLlmProvider implements LlmProvider {
  readonly providerId = 'mock';

  constructor(
    private readonly modelId = 'mock-deterministic-v1',
    private readonly enabledCapabilities: Partial<ModelCapabilities> = {},
  ) {}

  capabilities(modelId: string): ModelCapabilities {
    return {
      providerId: this.providerId,
      modelId,
      contextWindow: 4096,
      maxOutputTokens: 512,
      streaming: 'native',
      toolCalling: 'none',
      structuredOutput: 'json_object',
      usage: ['input_tokens', 'output_tokens', 'total_tokens'],
      timeoutMs: 1000,
      maxConcurrency: 8,
      evidence: {
        source: 'deterministic-test-double',
        checkedAt: '2026-10-21',
      },
      ...this.enabledCapabilities,
    };
  }

  generate(
    request: GenerationRequest,
    options?: ProviderCallOptions,
  ): Promise<GenerationResponse> {
    const capabilities = this.capabilities(this.modelId);
    validateGenerationRequest(capabilities, request, 'generate');
    if (options?.signal?.aborted)
      throw new ProviderError('ABORTED', {
        providerId: this.providerId,
        operation: 'generate',
      });
    const text = request.responseFormat
      ? '{"status":"MOCK_RESPONSE"}'
      : 'MOCK_RESPONSE';
    return Promise.resolve({
      providerId: this.providerId,
      modelId: this.modelId,
      text,
      finishReason: 'stop',
      usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 },
    });
  }

  async *stream(
    request: GenerationRequest,
    options?: ProviderCallOptions,
  ): AsyncIterable<GenerationEvent> {
    await Promise.resolve();
    const capabilities = this.capabilities(this.modelId);
    validateGenerationRequest(capabilities, request, 'stream');
    for (const text of ['MOCK_', 'RESPONSE']) {
      if (options?.signal?.aborted)
        throw new ProviderError('ABORTED', {
          providerId: this.providerId,
          operation: 'stream',
        });
      yield { type: 'text_delta', text };
    }
    yield {
      type: 'usage',
      usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 },
    };
    yield { type: 'done', finishReason: 'stop' };
  }
}
