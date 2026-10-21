import type {
  ResearchResult,
  SearchHadithToolInput,
  VerifiedResult,
} from '@matanexa/contracts';

export const RETRIEVAL_GATEWAY = Symbol('RETRIEVAL_GATEWAY');

export type RetrievalRecord = VerifiedResult | ResearchResult;
export type RetrievalMode = 'mock' | 'lexical' | 'hybrid' | 'lexical_fallback';

export interface RetrievalExecutionOptions {
  signal?: AbortSignal;
}

export interface RetrievalPage {
  records: RetrievalRecord[];
  totalCandidates: number;
  modeUsed: RetrievalMode;
  fallbackReason?: string;
}

export interface RetrievalGateway {
  search(
    input: SearchHadithToolInput,
    options?: RetrievalExecutionOptions,
  ): Promise<RetrievalPage>;
  findById(
    recordId: string,
    options?: RetrievalExecutionOptions,
  ): Promise<RetrievalRecord | undefined>;
}

export class RetrievalGatewayError extends Error {
  override readonly name = 'RetrievalGatewayError';

  constructor(readonly code: 'PROVIDER_UNAVAILABLE' | 'RETRIEVAL_UNAVAILABLE') {
    super(code);
  }
}
