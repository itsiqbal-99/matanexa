import { Injectable, Optional } from '@nestjs/common';
import { CorpusAccess } from '../../database/corpus-access';
import { DatabaseService } from '../../database/database.service';

// Retrieval transfers only fields required by the serializer. Raw provenance,
// duplicate source texts, vectors and ranking features stay inside PostgreSQL.
export const HADITH_RESULT_FIELDS = [
  'id',
  'collection_name',
  'source_slug',
  'source_name',
  'source_url',
  'source_attribution',
  'license_name',
  'license_reference_url',
  'hadith_number',
  'numbering_scheme',
  'book_name',
  'chapter_name',
  'narrator',
  'arabic_text',
  'indonesian_text',
  'reference_url',
  'translation_attribution',
  'grading_text',
  'grading_attribution',
  'grading_source_url',
  'verification_reference_url',
  'topic_slugs',
] as const;

export interface HadithRow {
  id: string;
  collection_name: string;
  source_slug: string;
  source_name: string;
  source_url: string;
  source_attribution: string;
  license_name: string;
  license_reference_url: string;
  hadith_number: string;
  numbering_scheme: string;
  book_name: string;
  chapter_name: string | null;
  narrator: string | null;
  arabic_text: string;
  indonesian_text: string;
  reference_url: string;
  translation_attribution: string;
  grading_text: string | null;
  grading_attribution: string | null;
  grading_source_url: string | null;
  verification_reference_url: string;
  topic_slugs?: string[];
  is_research_only?: boolean;
}

@Injectable()
export class HadithRepository {
  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly corpus?: CorpusAccess,
  ) {}
  async find(id: string): Promise<HadithRow | undefined> {
    return (
      await this.database.query<HadithRow>(
        `SELECT * FROM ${this.corpus?.relation ?? 'published_hadiths'} WHERE id=$1::uuid`,
        [id],
      )
    )[0];
  }
  sources() {
    return this.database.query<{ slug: string; displayName: string }>(
      `SELECT DISTINCT source_slug AS slug,source_name AS "displayName" FROM ${this.corpus?.relation ?? 'published_hadiths'} ORDER BY slug`,
    );
  }
}
export function serializeHadith(row: HadithRow) {
  return {
    id: row.id,
    title: row.book_name,
    excerpt: row.indonesian_text.slice(0, 500),
    citation: {
      collection: row.collection_name,
      number: row.hadith_number,
      numberingScheme: row.numbering_scheme,
    },
    collection: row.collection_name,
    sourceSlug: row.source_slug,
    hadithNumber: row.hadith_number,
    numberingScheme: row.numbering_scheme,
    bookName: row.book_name,
    chapterName: row.chapter_name,
    narrator: row.narrator,
    arabicText: row.arabic_text,
    translation: row.indonesian_text,
    indonesianText: row.indonesian_text,
    translationAttribution: row.translation_attribution,
    grade: row.grading_text,
    grader: row.grading_attribution,
    gradingSourceUrl: row.grading_source_url,
    sourceUrl: row.source_url,
    referenceUrl: row.reference_url,
    ...(row.is_research_only
      ? {
          isVerified: false as const,
          isResearchOnly: true as const,
          verificationReferenceUrl: null,
        }
      : {
          isVerified: true as const,
          verificationReferenceUrl: row.verification_reference_url,
        }),
    ...(row.topic_slugs ? { topics: row.topic_slugs } : {}),
    provenance: {
      sourceName: row.source_name,
      attribution: row.source_attribution,
      licenseName: row.license_name,
      licenseUrl: row.license_reference_url,
    },
  };
}
