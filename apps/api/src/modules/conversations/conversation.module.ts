import { Module } from '@nestjs/common';
import { ProviderModule } from '../../providers/provider.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import {
  CONVERSATION_TELEMETRY,
  ConversationTelemetryCollector,
} from './conversation-telemetry';
import { ConversationApiService } from './conversation-api.service';
import { ConversationController } from './conversation.controller';
import { InternalConversationGuard } from './internal-conversation.guard';

@Module({
  imports: [ProviderModule, RetrievalModule],
  controllers: [ConversationController],
  providers: [
    {
      provide: CONVERSATION_TELEMETRY,
      useFactory: () => new ConversationTelemetryCollector(),
    },
    ConversationOrchestratorService,
    ConversationApiService,
    InternalConversationGuard,
  ],
  exports: [
    ConversationOrchestratorService,
    ConversationApiService,
    CONVERSATION_TELEMETRY,
  ],
})
export class ConversationModule {}
