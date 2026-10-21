import {
  conversationStreamEventSchema,
  type ConversationStreamEvent,
  type ConversationStreamEventName,
} from '@matanexa/contracts';
import type { Response } from 'express';
import { ConversationApiError } from './conversation-api.error';

const TERMINAL_RESERVE_BYTES = 512;

export interface PendingConversationEvent {
  event: ConversationStreamEventName;
  data: unknown;
  terminal?: boolean;
}

export function serializeConversationEvent(
  event: ConversationStreamEvent,
): string {
  return `id: ${event.sequence}\nevent: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`;
}

export class ConversationSseWriter {
  private sequence = 0;
  private writtenBytes = 0;
  private terminal = false;

  constructor(
    private readonly response: Response,
    private readonly requestId: string,
    private readonly maximumBytes: number,
  ) {}

  start(): void {
    this.response.status(200);
    this.response.set({
      'Cache-Control': 'no-cache, no-store, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    });
    this.response.flushHeaders();
  }

  emit(event: PendingConversationEvent): void {
    this.emitBatch([event]);
  }

  emitBatch(pending: readonly PendingConversationEvent[]): void {
    if (this.terminal || this.response.destroyed || !pending.length) return;
    const terminalIndex = pending.findIndex((event) => event.terminal);
    if (
      (terminalIndex >= 0 && terminalIndex !== pending.length - 1) ||
      pending.filter((event) => event.terminal).length > 1
    )
      throw new ConversationApiError('ORCHESTRATION_FAILED');

    const chunks = pending.map((item, index) => {
      const event = conversationStreamEventSchema.parse({
        version: 2,
        requestId: this.requestId,
        sequence: this.sequence + index + 1,
        emittedAt: new Date().toISOString(),
        event: item.event,
        data: item.data,
      });
      return serializeConversationEvent(event);
    });
    const bytes = chunks.reduce(
      (total, chunk) => total + Buffer.byteLength(chunk, 'utf8'),
      0,
    );
    const containsTerminal = terminalIndex >= 0;
    const limit = containsTerminal
      ? this.maximumBytes
      : this.maximumBytes - TERMINAL_RESERVE_BYTES;
    if (this.writtenBytes + bytes > limit)
      throw new ConversationApiError('OUTPUT_TOO_LARGE');

    for (const chunk of chunks) this.response.write(chunk);
    this.sequence += chunks.length;
    this.writtenBytes += bytes;
    if (containsTerminal) {
      this.terminal = true;
      this.response.end();
    }
  }

  fail(error: ConversationApiError): void {
    if (this.terminal || this.response.destroyed) return;
    const event = conversationStreamEventSchema.parse({
      version: 2,
      requestId: this.requestId,
      sequence: this.sequence + 1,
      emittedAt: new Date().toISOString(),
      event: 'error',
      data: {
        code: error.code,
        message: error.publicError.message,
        retryable: error.retryable,
      },
    });
    const chunk = serializeConversationEvent(event);
    if (
      this.writtenBytes + Buffer.byteLength(chunk, 'utf8') <=
      this.maximumBytes
    )
      this.response.write(chunk);
    this.terminal = true;
    this.response.end();
  }
}
