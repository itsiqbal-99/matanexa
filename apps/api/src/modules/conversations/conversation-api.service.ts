import { Inject, Injectable } from '@nestjs/common';
import {
  conversationTurnResultSchema,
  type ConversationContext,
  type ConversationTurnResult,
} from '@matanexa/contracts';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import { ConversationOrchestrationError } from './conversation.error';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ConversationApiError } from './conversation-api.error';

@Injectable()
export class ConversationApiService {
  private activeRequests = 0;

  constructor(
    private readonly orchestrator: ConversationOrchestratorService,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  async execute(
    context: ConversationContext,
    callerSignal?: AbortSignal,
  ): Promise<ConversationTurnResult> {
    if (callerSignal?.aborted) throw new ConversationApiError('ABORTED');
    if (this.activeRequests >= this.environment.conversationApiMaxConcurrency)
      throw new ConversationApiError('CONCURRENCY_LIMIT');

    this.activeRequests++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.activeRequests--;
    };
    const controller = new AbortController();
    let timedOut = false;
    let rejectBudget: ((error: ConversationApiError) => void) | undefined;
    const budget = new Promise<never>((_resolve, reject) => {
      rejectBudget = reject;
    });
    const onCallerAbort = () => {
      controller.abort();
      rejectBudget?.(new ConversationApiError('ABORTED'));
    };
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      rejectBudget?.(new ConversationApiError('TIMEOUT'));
    }, this.environment.conversationApiTimeoutMs);

    try {
      const operation = Promise.resolve()
        .then(() =>
          this.orchestrator.execute(context, { signal: controller.signal }),
        )
        .then((result) => {
          const parsed = conversationTurnResultSchema.safeParse(result);
          if (!parsed.success)
            throw new ConversationApiError('ORCHESTRATION_FAILED');
          return parsed.data;
        })
        .finally(release);
      return await Promise.race([operation, budget]);
    } catch (error) {
      if (error instanceof ConversationApiError) throw error;
      if (timedOut) throw new ConversationApiError('TIMEOUT');
      if (callerSignal?.aborted) throw new ConversationApiError('ABORTED');
      if (error instanceof ConversationOrchestrationError) {
        if (error.code === 'ABORTED') throw new ConversationApiError('ABORTED');
        if (error.code === 'OUTPUT_TOO_LARGE')
          throw new ConversationApiError('OUTPUT_TOO_LARGE');
        if (
          error.code === 'INVALID_CONTEXT' ||
          error.code === 'CONTEXT_TOO_LARGE'
        )
          throw new ConversationApiError('INVALID_REQUEST');
      }
      throw new ConversationApiError('ORCHESTRATION_FAILED');
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  }
}
