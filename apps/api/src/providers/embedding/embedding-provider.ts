import type { ProviderCallOptions } from '../provider-contract';

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
export const ACTIVE_EMBEDDING_MODEL = '@cf/baai/bge-m3';
export const ACTIVE_EMBEDDING_DIMENSIONS = 1024;

export type EmbeddingErrorCode =
  | 'NOT_CONFIGURED'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'INVALID_RESPONSE'
  | 'REMOTE_ERROR';

export class EmbeddingProviderError extends Error {
  override readonly name = 'EmbeddingProviderError';

  constructor(
    readonly code: EmbeddingErrorCode,
    readonly httpStatus?: number,
  ) {
    super(code);
  }
}

export interface EmbeddingModelDescriptor {
  providerId: string;
  modelId: string;
  dimensions: number;
  maxBatchSize: number;
  maxInputCharacters: number;
}

export interface EmbeddingProvider {
  readonly providerId: string;
  readonly configured: boolean;
  readonly descriptor: EmbeddingModelDescriptor;
  embed(
    texts: readonly string[],
    options?: ProviderCallOptions,
  ): Promise<number[][]>;
}
