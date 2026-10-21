import { z } from 'zod';

export const publicErrorCodes = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'DATABASE_UNAVAILABLE',
  'PROVIDER_UNAVAILABLE',
  'UNAUTHORIZED',
  'REQUEST_TIMEOUT',
  'REQUEST_LIMITED',
  'REQUEST_ABORTED',
  'CONVERSATION_UNAVAILABLE',
  'REQUEST_ERROR',
  'INTERNAL_ERROR',
  'LOCAL_RESEARCH_ONLY',
] as const;

export type PublicErrorCode = (typeof publicErrorCodes)[number];

export const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.enum(publicErrorCodes),
        message: z.string().min(1),
        requestId: z.uuid(),
      })
      .strict(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
