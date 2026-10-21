import { Module } from '@nestjs/common';
import { HadithModule } from '../hadiths/hadith.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { MockRepository } from './mock.repository';
import { QueryNormalizer } from './query-normalizer';
import { QueryAnalyzer } from './query-analyzer';
import { SynonymService } from './synonym.service';
import { RelevanceRanker } from './relevance-ranker';
import { SearchRepository } from './search.repository';
import { SemanticRepository } from './semantic.repository';
import { ProviderModule } from '../../providers/provider.module';
@Module({
  imports: [HadithModule, ProviderModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    MockRepository,
    QueryNormalizer,
    QueryAnalyzer,
    SynonymService,
    RelevanceRanker,
    SearchRepository,
    SemanticRepository,
  ],
  exports: [SearchService],
})
export class SearchModule {}
