import { Module } from '@nestjs/common';
import { HadithModule } from '../hadiths/hadith.module';
import { SearchModule } from '../search/search.module';
import { PostgresRetrievalGateway } from './postgres-retrieval.gateway';
import { RETRIEVAL_GATEWAY } from './retrieval.gateway';
import { RetrievalToolExecutor } from './retrieval-tool.executor';

@Module({
  imports: [HadithModule, SearchModule],
  providers: [
    PostgresRetrievalGateway,
    { provide: RETRIEVAL_GATEWAY, useExisting: PostgresRetrievalGateway },
    RetrievalToolExecutor,
  ],
  exports: [RETRIEVAL_GATEWAY, RetrievalToolExecutor],
})
export class RetrievalModule {}
