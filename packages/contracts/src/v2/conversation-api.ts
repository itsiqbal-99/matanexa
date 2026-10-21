import { z } from 'zod';
import {
  conversationContextSchema,
  conversationExecutionStatuses,
  conversationTurnResultSchema,
} from './conversation';
import { evidenceSchema } from './retrieval';

export const conversationTurnRequestSchema = z
  .object({ context: conversationContextSchema })
  .strict();

export const conversationStreamEventNames = [
  'message_started',
  'status_changed',
  'text_delta',
  'reference_added',
  'message_completed',
  'error',
] as const;

export const conversationStreamErrorCodes = [
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'TIMEOUT',
  'CONCURRENCY_LIMIT',
  'OUTPUT_TOO_LARGE',
  'ABORTED',
  'ORCHESTRATION_FAILED',
] as const;

const eventEnvelope = {
  version: z.literal(2),
  requestId: z.uuid(),
  sequence: z.number().int().positive(),
  emittedAt: z.iso.datetime({ offset: true }),
};

const messageStartedEventSchema = z
  .object({
    ...eventEnvelope,
    event: z.literal('message_started'),
    data: z
      .object({
        conversationId: z.uuid(),
        delivery: z.literal('buffered_validated'),
      })
      .strict(),
  })
  .strict();

const statusChangedEventSchema = z
  .object({
    ...eventEnvelope,
    event: z.literal('status_changed'),
    data: z.discriminatedUnion('status', [
      z.object({ status: z.literal('orchestrating') }).strict(),
      z
        .object({
          status: z.literal('validated'),
          resultStatus: z.enum(conversationExecutionStatuses),
        })
        .strict(),
    ]),
  })
  .strict();

const textDeltaEventSchema = z
  .object({
    ...eventEnvelope,
    event: z.literal('text_delta'),
    data: z
      .object({
        messageId: z.string().min(1).max(128),
        text: z.string().min(1).max(4000),
        source: z.enum(['buffered_validated', 'provider_native_validated']),
      })
      .strict(),
  })
  .strict();

const referenceAddedEventSchema = z
  .object({
    ...eventEnvelope,
    event: z.literal('reference_added'),
    data: z
      .object({
        messageId: z.string().min(1).max(128),
        evidence: evidenceSchema,
      })
      .strict(),
  })
  .strict();

const messageCompletedEventSchema = z
  .object({
    ...eventEnvelope,
    event: z.literal('message_completed'),
    data: z.object({ result: conversationTurnResultSchema }).strict(),
  })
  .strict();

const errorEventSchema = z
  .object({
    ...eventEnvelope,
    event: z.literal('error'),
    data: z
      .object({
        code: z.enum(conversationStreamErrorCodes),
        message: z.string().min(1).max(200),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const conversationStreamEventSchema = z.discriminatedUnion('event', [
  messageStartedEventSchema,
  statusChangedEventSchema,
  textDeltaEventSchema,
  referenceAddedEventSchema,
  messageCompletedEventSchema,
  errorEventSchema,
]);

export type ConversationTurnRequest = z.infer<
  typeof conversationTurnRequestSchema
>;
export type ConversationStreamEvent = z.infer<
  typeof conversationStreamEventSchema
>;
export type ConversationStreamEventName =
  (typeof conversationStreamEventNames)[number];
export type ConversationStreamErrorCode =
  (typeof conversationStreamErrorCodes)[number];
