import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HadithModule } from './modules/hadiths/hadith.module';
import { SourcesModule } from './modules/sources/sources.module';
import { HealthModule } from './modules/health/health.module';
import { SearchModule } from './modules/search/search.module';
import { CommonModule } from './common/common.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { ConversationModule } from './modules/conversations/conversation.module';

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    HadithModule,
    SourcesModule,
    HealthModule,
    SearchModule,
    RetrievalModule,
    ConversationModule,
  ],
})
export class AppModule {}
