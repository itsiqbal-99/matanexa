export const conversationErrorCodes = [
  'INVALID_CONTEXT',
  'CONTEXT_TOO_LARGE',
  'RETRIEVAL_FAILED',
  'TOOL_LIMIT',
  'OUTPUT_TOO_LARGE',
  'ABORTED',
] as const;

export type ConversationErrorCode = (typeof conversationErrorCodes)[number];

export class ConversationOrchestrationError extends Error {
  override readonly name = 'ConversationOrchestrationError';

  constructor(
    readonly code: ConversationErrorCode,
    readonly requestId?: string,
  ) {
    super(code);
  }
}
