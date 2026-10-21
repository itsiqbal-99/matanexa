import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  conversationTurnRequestSchema,
  type ConversationContext,
  type ConversationTurnResult,
} from '@matanexa/contracts';
import type { Request, Response } from 'express';
import { RequestContextService } from '../../common/request-context.service';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import { ConversationApiError } from './conversation-api.error';
import { ConversationApiService } from './conversation-api.service';
import { ConversationSseWriter } from './conversation-sse.writer';
import { InternalConversationGuard } from './internal-conversation.guard';

@Controller('api/v2/internal/conversations')
@UseGuards(InternalConversationGuard)
export class ConversationController {
  constructor(
    private readonly api: ConversationApiService,
    private readonly requestContext: RequestContextService,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  @Post('turn')
  @HttpCode(HttpStatus.OK)
  async turn(
    @Body() body: unknown,
    @Req() _request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ConversationTurnResult> {
    const context = this.parse(body);
    response.setHeader('Cache-Control', 'no-store');
    const lifecycle = this.lifecycle(response);
    try {
      return await this.api.execute(context, lifecycle.signal);
    } finally {
      lifecycle.finish();
    }
  }

  @Post('turn/stream')
  @HttpCode(HttpStatus.OK)
  async stream(
    @Body() body: unknown,
    @Req() _request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const context = this.parse(body);
    const lifecycle = this.lifecycle(response);
    const writer = new ConversationSseWriter(
      response,
      this.requestContext.currentRequestId(),
      this.environment.conversationSseMaxOutputBytes,
    );
    writer.start();
    try {
      writer.emit({
        event: 'message_started',
        data: {
          conversationId: context.conversationId,
          delivery: 'buffered_validated',
        },
      });
      writer.emit({
        event: 'status_changed',
        data: { status: 'orchestrating' },
      });
      const result = await this.api.execute(context, lifecycle.signal);
      writer.emitBatch([
        {
          event: 'status_changed',
          data: { status: 'validated', resultStatus: result.execution.status },
        },
        ...result.evidence.map((evidence) => ({
          event: 'reference_added' as const,
          data: { messageId: result.assistant.id, evidence },
        })),
        {
          event: 'text_delta',
          data: {
            messageId: result.assistant.id,
            text: result.assistant.content,
            source: 'buffered_validated',
          },
        },
        {
          event: 'message_completed',
          data: { result },
          terminal: true,
        },
      ]);
    } catch (error) {
      if (!response.destroyed)
        writer.fail(
          error instanceof ConversationApiError
            ? error
            : new ConversationApiError('ORCHESTRATION_FAILED'),
        );
    } finally {
      lifecycle.finish();
    }
  }

  private parse(body: unknown): ConversationContext {
    const parsed = conversationTurnRequestSchema.safeParse(body);
    if (!parsed.success) throw new ConversationApiError('INVALID_REQUEST');
    return parsed.data.context;
  }

  private lifecycle(response: Response): {
    signal: AbortSignal;
    finish: () => void;
  } {
    const controller = new AbortController();
    let finished = false;
    const onClose = () => {
      if (!finished) controller.abort();
    };
    response.once('close', onClose);
    return {
      signal: controller.signal,
      finish: () => {
        finished = true;
        response.removeListener('close', onClose);
      },
    };
  }
}
