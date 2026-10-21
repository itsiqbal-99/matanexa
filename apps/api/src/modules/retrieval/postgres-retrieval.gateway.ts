import { Inject, Injectable } from '@nestjs/common';
import type {
  ResearchResult,
  SearchHadithToolInput,
  SearchResult,
  VerifiedResult,
} from '@matanexa/contracts';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import {
  HadithRepository,
  serializeHadith,
} from '../hadiths/hadith.repository';
import { SearchService } from '../search/search.service';
import type {
  RetrievalExecutionOptions,
  RetrievalGateway,
  RetrievalPage,
  RetrievalRecord,
} from './retrieval.gateway';

function isEvidenceRecord(
  result: SearchResult,
): result is VerifiedResult | ResearchResult {
  return result.hadithNumber !== null;
}

@Injectable()
export class PostgresRetrievalGateway implements RetrievalGateway {
  constructor(
    private readonly searchService: SearchService,
    private readonly hadithRepository: HadithRepository,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  async search(
    input: SearchHadithToolInput,
    options: RetrievalExecutionOptions = {},
  ): Promise<RetrievalPage> {
    const response = await this.searchService.search(
      { ...input, page: 1 },
      options,
    );
    return {
      records: response.data.results.filter(isEvidenceRecord),
      totalCandidates: response.data.totalCandidates,
      modeUsed: response.meta.modeUsed,
      ...(response.meta.fallbackReason
        ? { fallbackReason: response.meta.fallbackReason }
        : {}),
    };
  }

  async findById(
    recordId: string,
    options: RetrievalExecutionOptions = {},
  ): Promise<RetrievalRecord | undefined> {
    if (options.signal?.aborted) return undefined;
    if (this.environment.mode === 'mock') return undefined;
    const row = await this.hadithRepository.find(recordId);
    if (!row) return undefined;
    return serializeHadith(row);
  }
}
