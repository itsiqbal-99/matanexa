import { Inject, Injectable } from '@nestjs/common';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import { serializeHadith } from '../hadiths/hadith.repository';
import { randomUUID } from 'node:crypto';
import { MockRepository } from './mock.repository';
import type { SearchDto } from './search.schema';
import { QueryAnalyzer } from './query-analyzer';
import { SearchRepository } from './search.repository';
import {
  CloudflareEmbedding,
  EmbeddingUnavailable,
} from '../../providers/embedding/cloudflare-embedding';
import {
  SemanticRepository,
  reciprocalRankFusion,
} from './semantic.repository';

@Injectable()
export class SearchService {
  constructor(
    private readonly repository: MockRepository,
    private readonly searchRepository: SearchRepository,
    private readonly analyzer: QueryAnalyzer,
    @Inject(ENVIRONMENT) private readonly env: Environment,
    private readonly embedding: CloudflareEmbedding,
    private readonly semantic: SemanticRepository,
  ) {}

  async search(dto: SearchDto) {
    const offset = (dto.page - 1) * dto.limit;
    const analysis =
      this.env.mode !== 'mock' ? this.analyzer.analyze(dto.query) : null;
    let modeUsed: 'mock' | 'lexical' | 'hybrid' | 'lexical_fallback' =
      this.env.mode;
    let fallbackReason: string | undefined;
    let found: Awaited<ReturnType<SearchRepository['search']>> | null = null;
    if (analysis && this.env.mode === 'hybrid') {
      // Readiness errors are DB failures, outside the provider fallback boundary.
      const ready =
        this.embedding.configured && !analysis.ambiguous
          ? await this.semantic.ready(dto.filters?.sourceSlugs)
          : false;
      if (!ready) {
        modeUsed = 'lexical_fallback';
        fallbackReason = analysis.ambiguous
          ? 'AMBIGUOUS_QUERY'
          : !this.embedding.configured
            ? 'NOT_CONFIGURED'
            : 'INDEX_NOT_READY';
        found = await this.searchRepository.search(dto, analysis);
      } else {
        // Lexical retrieval and the remote embedding are independent. Handle the
        // provider rejection immediately so no unhandled promise can leak errors.
        const embeddingRequest = this.embedding
          .embed([analysis.normalized])
          .then((vectors) => ({
            vectors,
            reason: undefined as string | undefined,
          }))
          .catch((error: unknown) => ({
            vectors: undefined,
            reason:
              error instanceof EmbeddingUnavailable
                ? error.code
                : 'EMBEDDING_UNAVAILABLE',
          }));
        const [lexical, embedding] = await Promise.all([
          this.searchRepository.search(
            { ...dto, limit: 100, page: 1 },
            analysis,
          ),
          embeddingRequest,
        ]);
        let candidates = lexical.results;
        if (embedding.vectors) {
          const semantic = await this.semantic.search(
            embedding.vectors[0],
            dto.filters?.sourceSlugs,
          );
          if (semantic.length)
            candidates = reciprocalRankFusion(candidates, semantic);
          else fallbackReason = 'INDEX_NOT_READY';
        } else fallbackReason = embedding.reason;
        if (fallbackReason) modeUsed = 'lexical_fallback';
        found =
          fallbackReason && offset + dto.limit > 100
            ? await this.searchRepository.search(dto, analysis)
            : {
                results: candidates.slice(offset, offset + dto.limit),
                total:
                  modeUsed === 'hybrid' ? candidates.length : lexical.total,
              };
      }
    } else if (analysis)
      found = await this.searchRepository.search(dto, analysis);
    const mock = found
      ? []
      : this.repository.find(dto.query, dto.filters?.sourceSlugs);
    const results = found
      ? found.results.map(serializeHadith)
      : mock.slice(offset, offset + dto.limit);
    const total = found ? found.total : mock.length;
    return {
      data: {
        query: dto.query,
        results,
        totalCandidates: total,
      },
      meta: {
        page: dto.page,
        limit: dto.limit,
        hasMore: offset + dto.limit < total && dto.page < 10,
        modeUsed,
        ...(this.env.dataScope === 'local_pilot'
          ? { dataScope: 'local_pilot' as const }
          : {}),
        ...(fallbackReason ? { fallbackReason } : {}),
        requestId: randomUUID(),
        ...(analysis
          ? {
              queryStatus: analysis.ambiguous
                ? ('ambiguous' as const)
                : ('ready' as const),
            }
          : {}),
      },
    };
  }
}
