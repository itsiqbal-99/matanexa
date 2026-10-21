import type { ProviderCallOptions } from '../provider-contract';
import {
  ACTIVE_EMBEDDING_DIMENSIONS,
  type EmbeddingModelDescriptor,
  EmbeddingProviderError,
  type EmbeddingProvider,
} from './embedding-provider';

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly providerId = 'mock';
  readonly configured = true;
  readonly descriptor: EmbeddingModelDescriptor = {
    providerId: this.providerId,
    modelId: 'mock-embedding-v1',
    dimensions: ACTIVE_EMBEDDING_DIMENSIONS,
    maxBatchSize: 4,
    maxInputCharacters: 12000,
  };

  embed(
    texts: readonly string[],
    options?: ProviderCallOptions,
  ): Promise<number[][]> {
    if (options?.signal?.aborted) throw new EmbeddingProviderError('ABORTED');
    if (
      texts.length < 1 ||
      texts.length > this.descriptor.maxBatchSize ||
      texts.some(
        (text) =>
          !text.trim() || text.length > this.descriptor.maxInputCharacters,
      )
    )
      throw new EmbeddingProviderError('INVALID_RESPONSE');
    return Promise.resolve(
      texts.map((text) => {
        const seed = [...text].reduce(
          (value, character) => (value * 31 + character.codePointAt(0)!) >>> 0,
          2166136261,
        );
        return Array.from(
          { length: ACTIVE_EMBEDDING_DIMENSIONS },
          (_, index) => ((seed + index * 2654435761) % 1009) / 1009 || 0.0001,
        );
      }),
    );
  }
}
