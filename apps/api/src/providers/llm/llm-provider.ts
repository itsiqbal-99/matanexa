import { ProviderError } from '../provider-contract';
import type { ProviderCallOptions, ProviderUsage } from '../provider-contract';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface GenerationMessage {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ResponseFormat =
  | { type: 'json_object' }
  | { type: 'json_schema'; name: string; schema: Record<string, unknown> };

export interface GenerationRequest {
  modelId: string;
  messages: readonly GenerationMessage[];
  maxOutputTokens: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
  tools?: readonly ToolDefinition[];
  correlationId?: string;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface GenerationResponse {
  providerId: string;
  modelId: string;
  text: string;
  finishReason: 'stop' | 'length' | 'tool_call' | 'unknown';
  usage?: ProviderUsage;
  toolCalls?: readonly NormalizedToolCall[];
  providerRequestId?: string;
}

export type GenerationEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'usage'; usage: ProviderUsage }
  | {
      type: 'done';
      finishReason: GenerationResponse['finishReason'];
    };

export interface ModelCapabilities {
  providerId: string;
  modelId: string;
  contextWindow: number | null;
  maxOutputTokens: number;
  streaming: 'native' | 'none';
  toolCalling: 'native' | 'none';
  structuredOutput: 'json_schema' | 'json_object' | 'none';
  usage: readonly ('input_tokens' | 'output_tokens' | 'total_tokens')[];
  timeoutMs: number;
  maxConcurrency: number;
  evidence: { source: string; checkedAt: string };
}

export interface LlmProvider {
  readonly providerId: string;
  capabilities(modelId: string): ModelCapabilities;
  generate(
    request: GenerationRequest,
    options?: ProviderCallOptions,
  ): Promise<GenerationResponse>;
  stream(
    request: GenerationRequest,
    options?: ProviderCallOptions,
  ): AsyncIterable<GenerationEvent>;
}

export function validateGenerationRequest(
  capabilities: ModelCapabilities,
  request: GenerationRequest,
  operation: 'generate' | 'stream',
): void {
  const invalid =
    request.modelId !== capabilities.modelId ||
    request.messages.length < 1 ||
    request.messages.length > 50 ||
    request.messages.some(
      (message) =>
        !['system', 'user', 'assistant', 'tool'].includes(message.role) ||
        !message.content.trim() ||
        message.content.length > 32000,
    ) ||
    request.messages.reduce((sum, message) => sum + message.content.length, 0) >
      100000 ||
    !Number.isInteger(request.maxOutputTokens) ||
    request.maxOutputTokens < 1 ||
    request.maxOutputTokens > capabilities.maxOutputTokens ||
    (request.temperature !== undefined &&
      (!Number.isFinite(request.temperature) ||
        request.temperature < 0 ||
        request.temperature > 2));
  if (invalid)
    throw new ProviderError('POLICY_REJECTED', {
      providerId: capabilities.providerId,
      operation,
    });
  if (operation === 'stream' && capabilities.streaming !== 'native')
    throw new ProviderError('UNSUPPORTED_CAPABILITY', {
      providerId: capabilities.providerId,
      operation,
    });
  if (request.tools?.length && capabilities.toolCalling !== 'native')
    throw new ProviderError('UNSUPPORTED_CAPABILITY', {
      providerId: capabilities.providerId,
      operation,
    });
  if (
    request.responseFormat?.type === 'json_schema' &&
    capabilities.structuredOutput !== 'json_schema'
  )
    throw new ProviderError('UNSUPPORTED_CAPABILITY', {
      providerId: capabilities.providerId,
      operation,
    });
  if (
    request.responseFormat?.type === 'json_object' &&
    !['json_object', 'json_schema'].includes(capabilities.structuredOutput)
  )
    throw new ProviderError('UNSUPPORTED_CAPABILITY', {
      providerId: capabilities.providerId,
      operation,
    });
}
