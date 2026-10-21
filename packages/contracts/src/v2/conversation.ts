import { z } from 'zod';
import { evidenceSchema } from './retrieval';

const messageBase = {
  id: z.string().min(1).max(128),
  content: z.string().min(1).max(4000),
  createdAt: z.iso.datetime({ offset: true }),
};

export const userConversationMessageSchema = z
  .object({ ...messageBase, role: z.literal('user') })
  .strict();

export const assistantConversationMessageSchema = z
  .object({
    ...messageBase,
    role: z.literal('assistant'),
    evidenceRecordIds: z
      .array(z.uuid())
      .max(10)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
  })
  .strict();

export const conversationMessageSchema = z.discriminatedUnion('role', [
  userConversationMessageSchema,
  assistantConversationMessageSchema,
]);

export const conversationContextSchema = z
  .object({
    version: z.literal(2),
    conversationId: z.uuid(),
    messages: z.array(conversationMessageSchema).min(1).max(20),
  })
  .strict()
  .superRefine((context, issue) => {
    if (
      new Set(context.messages.map((message) => message.id)).size !==
      context.messages.length
    )
      issue.addIssue({
        code: 'custom',
        path: ['messages'],
        message: 'Message IDs must be unique.',
      });
    const totalCharacters = context.messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );
    if (totalCharacters > 40000)
      issue.addIssue({
        code: 'custom',
        path: ['messages'],
        message: 'Conversation context is too large.',
      });
  });

export const conversationExecutionStatuses = [
  'grounded',
  'evidence_only',
  'no_evidence',
  'failed',
  'aborted',
] as const;

export const conversationPlanningStrategies = [
  'latest_user',
  'llm_reformulation',
  'native_tool',
] as const;

const providerUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
  })
  .strict();

export const conversationTurnResultSchema = z
  .object({
    version: z.literal(2),
    conversationId: z.uuid(),
    assistant: assistantConversationMessageSchema,
    evidence: z.array(evidenceSchema).max(10),
    execution: z
      .object({
        requestId: z.uuid(),
        status: z.enum(conversationExecutionStatuses),
        planningStrategy: z.enum(conversationPlanningStrategies),
        selectedMessageCount: z.number().int().nonnegative(),
        omittedMessageCount: z.number().int().nonnegative(),
        toolExecutions: z.number().int().nonnegative(),
        staleEvidenceCount: z.number().int().nonnegative(),
        durationMs: z.number().nonnegative(),
        fallbackReason: z.string().min(1).max(64).optional(),
      })
      .strict(),
    provider: z
      .object({
        providerId: z.string().min(1).max(64),
        modelId: z.string().min(1).max(256).nullable(),
        generationCalls: z.number().int().nonnegative(),
        durationMs: z.number().nonnegative(),
        usage: providerUsageSchema.optional(),
      })
      .strict(),
  })
  .strict();

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationContext = z.infer<typeof conversationContextSchema>;
export type ConversationTurnResult = z.infer<
  typeof conversationTurnResultSchema
>;
export type ConversationExecutionStatus =
  (typeof conversationExecutionStatuses)[number];
export type ConversationPlanningStrategy =
  (typeof conversationPlanningStrategies)[number];
