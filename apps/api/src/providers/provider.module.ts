import { Module } from '@nestjs/common';
import { ENVIRONMENT, type Environment } from '../config/environment';
import { CloudflareEmbeddingAdapter } from './embedding/cloudflare-embedding';
import { EMBEDDING_PROVIDER } from './embedding/embedding-provider';
import { CloudflareLlmAdapter } from './llm/cloudflare-llm.adapter';
import { DisabledLlmProvider } from './llm/disabled-llm.provider';
import { LLM_PROVIDER, type LlmProvider } from './llm/llm-provider';
import {
  PROVIDER_TELEMETRY,
  ProviderTelemetryCollector,
} from './provider-telemetry';

@Module({
  providers: [
    CloudflareEmbeddingAdapter,
    {
      provide: EMBEDDING_PROVIDER,
      useExisting: CloudflareEmbeddingAdapter,
    },
    {
      provide: PROVIDER_TELEMETRY,
      useFactory: () => new ProviderTelemetryCollector(),
    },
    CloudflareLlmAdapter,
    {
      provide: LLM_PROVIDER,
      inject: [ENVIRONMENT, CloudflareLlmAdapter],
      useFactory: (
        environment: Environment,
        cloudflare: CloudflareLlmAdapter,
      ): LlmProvider =>
        environment.llmProvider === 'cloudflare'
          ? cloudflare
          : new DisabledLlmProvider(),
    },
  ],
  exports: [
    EMBEDDING_PROVIDER,
    CloudflareEmbeddingAdapter,
    LLM_PROVIDER,
    CloudflareLlmAdapter,
    PROVIDER_TELEMETRY,
  ],
})
export class ProviderModule {}
