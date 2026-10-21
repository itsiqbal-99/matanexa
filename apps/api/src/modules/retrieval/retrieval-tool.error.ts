export const retrievalToolErrorCodes = [
  'TOOL_NOT_ALLOWED',
  'INVALID_INPUT',
  'NOT_FOUND',
  'INVALID_CITATION',
  'DUPLICATE_EVIDENCE',
  'RESEARCH_ONLY_REJECTED',
  'PROVIDER_UNAVAILABLE',
  'RETRIEVAL_UNAVAILABLE',
  'TIMEOUT',
  'ABORTED',
  'OUTPUT_TOO_LARGE',
] as const;

export type RetrievalToolErrorCode = (typeof retrievalToolErrorCodes)[number];

export class RetrievalToolError extends Error {
  override readonly name = 'RetrievalToolError';

  constructor(
    readonly code: RetrievalToolErrorCode,
    readonly requestId: string,
  ) {
    super(code);
  }
}
