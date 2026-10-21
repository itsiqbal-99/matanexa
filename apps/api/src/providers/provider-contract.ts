export const providerErrorCodes = [
  'NOT_CONFIGURED',
  'AUTHENTICATION_FAILED',
  'RATE_LIMITED',
  'TIMEOUT',
  'ABORTED',
  'UNAVAILABLE',
  'INVALID_RESPONSE',
  'UNSUPPORTED_CAPABILITY',
  'POLICY_REJECTED',
] as const;

export type ProviderErrorCode = (typeof providerErrorCodes)[number];
export type ProviderOperation = 'generate' | 'stream' | 'embed';

export class ProviderError extends Error {
  override readonly name = 'ProviderError';

  constructor(
    readonly code: ProviderErrorCode,
    readonly details: {
      providerId?: string;
      operation?: ProviderOperation;
      retryable?: boolean;
      httpStatus?: number;
    } = {},
  ) {
    super(code);
  }
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ProviderCallOptions {
  signal?: AbortSignal;
}

export interface AbortBudget {
  signal: AbortSignal;
  timedOut: () => boolean;
  cleanup: () => void;
}

export function createAbortBudget(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): AbortBudget {
  const controller = new AbortController();
  let timeoutReached = false;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timeoutReached = true;
    controller.abort();
  }, timeoutMs);
  timer.unref();
  return {
    signal: controller.signal,
    timedOut: () => timeoutReached,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

export function abortError(
  providerId: string,
  operation: ProviderOperation,
  callerSignal: AbortSignal | undefined,
  timedOut: boolean,
): ProviderError {
  return new ProviderError(
    callerSignal?.aborted ? 'ABORTED' : timedOut ? 'TIMEOUT' : 'UNAVAILABLE',
    { providerId, operation, retryable: !callerSignal?.aborted },
  );
}
