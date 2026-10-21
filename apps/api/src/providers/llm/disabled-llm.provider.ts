import { ProviderError } from '../provider-contract';
import type {
  GenerationEvent,
  GenerationResponse,
  LlmProvider,
  ModelCapabilities,
} from './llm-provider';

export class DisabledLlmProvider implements LlmProvider {
  readonly providerId = 'disabled';

  capabilities(modelId: string): ModelCapabilities {
    return {
      providerId: this.providerId,
      modelId,
      contextWindow: null,
      maxOutputTokens: 1,
      streaming: 'none',
      toolCalling: 'none',
      structuredOutput: 'none',
      usage: [],
      timeoutMs: 1,
      maxConcurrency: 0,
      evidence: { source: 'disabled', checkedAt: '2026-10-21' },
    };
  }

  generate(): Promise<GenerationResponse> {
    return Promise.reject(
      new ProviderError('NOT_CONFIGURED', {
        providerId: this.providerId,
        operation: 'generate',
      }),
    );
  }

  stream(): AsyncIterable<GenerationEvent> {
    const error = new ProviderError('NOT_CONFIGURED', {
      providerId: this.providerId,
      operation: 'stream',
    });
    return {
      [Symbol.asyncIterator](): AsyncIterator<GenerationEvent> {
        return { next: () => Promise.reject(error) };
      },
    };
  }
}
