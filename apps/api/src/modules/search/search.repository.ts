import { Injectable, Optional } from '@nestjs/common';
import { CorpusAccess } from '../../database/corpus-access';
import { DatabaseService } from '../../database/database.service';
import type { HadithRow } from '../hadiths/hadith.repository';
import { HADITH_RESULT_FIELDS } from '../hadiths/hadith.repository';
import type { SearchDto } from './search.schema';
import type { QueryAnalysis } from './query-analyzer';
import { RelevanceRanker, type RankingSignals } from './relevance-ranker';

// Internal features never reach serializeHadith/the public response.
export const LEXICAL_DIAGNOSTIC_SQL = `WITH q AS (
  SELECT to_tsquery('simple',$1) AS tsquery,$2::text AS normalized_query,$6::jsonb AS a,$7::jsonb AS w,
    ARRAY(SELECT jsonb_array_elements_text($6::jsonb->'primaryTerms')) AS primary_terms,
    ARRAY(SELECT jsonb_array_elements_text($6::jsonb->'equivalents')) AS equivalents,
    ARRAY(SELECT jsonb_array_elements_text($6::jsonb->'related')) AS related,
    ARRAY(SELECT jsonb_array_elements_text($6::jsonb->'phrases')) AS phrases,
    ARRAY(SELECT jsonb_array_elements_text($6::jsonb->'topicSlugs')) AS topics,
    ARRAY(SELECT jsonb_array_elements_text($6::jsonb->'negations')) AS negations,
    ARRAY(SELECT jsonb_array_elements_text($6::jsonb->'anchorTerms')) AS anchors
), candidates AS (
  SELECT h.*,q.*,trim(regexp_replace(lower(h.normalized_translation || ' ' || h.book_name || ' ' || coalesce(h.chapter_name,'')),
    '[^[:alnum:]]+',' ','g')) AS raw_document_text,
    trim(regexp_replace(lower(coalesce(h.chapter_name,'')),'[^[:alnum:]]+',' ','g')) AS chapter_text
  FROM published_hadiths h CROSS JOIN q
  WHERE NOT (q.a->>'ambiguous')::boolean
    AND ($3::text[] IS NULL OR h.source_slug=ANY($3))
    AND (h.search_document @@ q.tsquery OR h.topic_slugs && q.topics
      OR EXISTS(SELECT 1 FROM unnest(q.anchors) term WHERE length(term)>=5 AND h.normalized_translation %>> term))
), contextual AS (
  SELECT c.*,CASE WHEN 'parents'=ANY(topics)
    THEN regexp_replace(raw_document_text,'(^| )ibu (kota|jari)( |$)',' ','g')
    ELSE raw_document_text END AS document_text
  FROM candidates c
), signals AS (
  SELECT c.*,
    (SELECT count(*)::float FROM unnest(primary_terms) term WHERE strpos(' '||document_text||' ',' '||term||' ')>0)
      /greatest(cardinality(primary_terms),1) AS primary_signal,
    least((SELECT count(*)::float FROM unnest(phrases) term WHERE strpos(' '||document_text||' ',' '||term||' ')>0),1) AS phrase_signal,
    (SELECT count(*)::float FROM unnest(equivalents) term WHERE strpos(' '||document_text||' ',' '||term||' ')>0)
      /greatest(cardinality(equivalents),1) AS equivalent_signal,
    CASE WHEN topic_slugs && topics THEN 1.0 ELSE 0.0 END AS topic_signal,
    (SELECT count(*)::float FROM unnest(related) term WHERE strpos(' '||document_text||' ',' '||term||' ')>0)
      /greatest(cardinality(related),1) AS related_signal,
    (SELECT count(*)::float FROM unnest(primary_terms) term WHERE strpos(' '||chapter_text||' ',' '||term||' ')>0)
      /greatest(cardinality(primary_terms),1) AS chapter_signal,
    ts_rank_cd(search_document,tsquery,2)/(1.0+ts_rank_cd(search_document,tsquery,2)) AS fts_signal,
    coalesce((SELECT max(strict_word_similarity(term,normalized_translation)) FROM unnest(anchors) term WHERE length(term)>=5),0) AS typo_signal,
    (SELECT count(*)::float FROM unnest(negations) term WHERE strpos(' '||document_text||' ',' '||term||' ')>0)
      /greatest(cardinality(negations),1) AS negation_signal,
    (SELECT count(*) FROM unnest(anchors) term WHERE strpos(' '||document_text||' ',' '||term||' ')>0) AS anchor_hits
  FROM contextual c
), scored AS (
  SELECT s.*,
    primary_signal*(w->>'primary')::float/(1.0+length(document_text)/600.0) + phrase_signal*(w->>'phrase')::float +
    equivalent_signal*(w->>'equivalent')::float/(1.0+length(document_text)/600.0) + topic_signal*(w->>'topic')::float +
    related_signal*(w->>'related')::float + chapter_signal*(w->>'chapter')::float +
    fts_signal*(w->>'fts')::float + typo_signal*(w->>'typo')::float +
    negation_signal*(w->>'negation')::float +
    CASE WHEN cardinality(negations)>0 AND negation_signal=0 THEN (w->>'negationMissing')::float ELSE 0 END AS relevance
  FROM signals s WHERE anchor_hits>0 OR equivalent_signal>0 OR topic_signal>0 OR typo_signal>=0.72
    OR (cardinality(topics)>0 AND related_signal>0)
), deduplicated AS (
  SELECT *,row_number() OVER(PARTITION BY source_id,collection_id,numbering_scheme,hadith_number ORDER BY relevance DESC,id) AS duplicate_rank
  FROM scored
), eligible AS (SELECT * FROM deduplicated WHERE duplicate_rank=1), paged AS (
  SELECT * FROM eligible ORDER BY relevance DESC,source_slug,collection_id,numbering_scheme,hadith_number,id LIMIT $4 OFFSET $5
) SELECT (SELECT count(*)::int FROM eligible) AS total,
  coalesce((SELECT json_agg(paged ORDER BY relevance DESC,source_slug,collection_id,numbering_scheme,hadith_number,id) FROM paged),'[]'::json) AS results`;

// Full diagnostic rows are reserved for offline evaluation, never API retrieval.
export const LEXICAL_SQL = LEXICAL_DIAGNOSTIC_SQL.replace(
  'json_agg(paged ORDER BY',
  `json_agg(json_build_object(${HADITH_RESULT_FIELDS.map((field) => `'${field}',paged.${field}`).join(',')},
  'is_research_only',coalesce((to_jsonb(paged)->>'is_research_only')::boolean,false)) ORDER BY`,
);

export function retrievalTerms(analysis: QueryAnalysis): string {
  return [
    ...new Set(
      [...analysis.anchorTerms, ...analysis.equivalents, ...analysis.related]
        .flatMap((term) => term.split(' '))
        .filter((term) => /^[\p{L}\p{N}]+$/u.test(term)),
    ),
  ]
    .slice(0, 80)
    .join(' | ');
}
export function searchParameters(
  dto: SearchDto,
  analysis: QueryAnalysis,
  weights: RankingSignals,
): unknown[] {
  return [
    retrievalTerms(analysis),
    analysis.normalized,
    dto.filters?.sourceSlugs?.length ? dto.filters.sourceSlugs : null,
    dto.limit,
    (dto.page - 1) * dto.limit,
    JSON.stringify(analysis),
    JSON.stringify(weights),
  ];
}
@Injectable()
export class SearchRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly ranker: RelevanceRanker,
    @Optional() private readonly corpus?: CorpusAccess,
  ) {}
  async search(
    dto: SearchDto,
    analysis: QueryAnalysis,
  ): Promise<{ results: HadithRow[]; total: number }> {
    // Even ambiguous requests contact the DB: an outage must remain a 503.
    const [row] = await this.database.query<{
      results: HadithRow[];
      total: number;
    }>(this.sql, searchParameters(dto, analysis, this.ranker.weights));
    if (!row) throw new Error('Missing database result envelope');
    return row;
  }
  get sql(): string {
    return this.corpus?.relation === 'local_pilot_hadiths'
      ? LEXICAL_SQL.replace(
          'FROM published_hadiths h',
          'FROM local_pilot_hadiths h',
        )
      : LEXICAL_SQL;
  }
}
