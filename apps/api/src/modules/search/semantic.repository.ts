import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CorpusAccess } from '../../database/corpus-access';
import type { HadithRow } from '../hadiths/hadith.repository';
import { HADITH_RESULT_FIELDS } from '../hadiths/hadith.repository';
import { ACTIVE_EMBEDDING_MODEL } from '../../providers/embedding/embedding-provider';
@Injectable()
export class SemanticRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly corpus: CorpusAccess,
  ) {}
  async ready(sourceSlugs?: string[]): Promise<boolean> {
    const [row] = await this.db.query<{ ready: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.corpus.relation} h
      JOIN hadith_embeddings e ON e.hadith_id=h.id AND e.content_hash=h.content_hash AND e.model=$1
      WHERE ($2::text[] IS NULL OR h.source_slug=ANY($2))) AS ready`,
      [ACTIVE_EMBEDDING_MODEL, sourceSlugs?.length ? sourceSlugs : null],
    );
    return row?.ready === true;
  }
  async search(vector: number[], sourceSlugs?: string[]): Promise<HadithRow[]> {
    return this.db.query<HadithRow>(
      `SELECT ${HADITH_RESULT_FIELDS.map((field) => `h.${field}`).join(',')},
      ${this.corpus.relation === 'local_pilot_hadiths' ? 'true' : 'false'} AS is_research_only FROM ${this.corpus.relation} h
      JOIN hadith_embeddings e ON e.hadith_id=h.id AND e.content_hash=h.content_hash AND e.model=$2
      WHERE ($3::text[] IS NULL OR h.source_slug=ANY($3))
      ORDER BY e.embedding <=> $1::vector,h.id LIMIT 100`,
      [
        JSON.stringify(vector),
        ACTIVE_EMBEDDING_MODEL,
        sourceSlugs?.length ? sourceSlugs : null,
      ],
    );
  }
}
export function reciprocalRankFusion(
  lexical: HadithRow[],
  semantic: HadithRow[],
): HadithRow[] {
  const scores = new Map<string, { row: HadithRow; score: number }>();
  for (const list of [lexical, semantic]) {
    const seen = new Set<string>();
    list.forEach((row, index) => {
      if (seen.has(row.id)) return;
      seen.add(row.id);
      const prior = scores.get(row.id);
      scores.set(row.id, {
        row,
        score: (prior?.score ?? 0) + 1 / (60 + index + 1),
      });
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id))
    .map((x) => x.row);
}
