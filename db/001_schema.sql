-- Matanexa schema v2. Manual run on a dedicated dev/test Neon branch.
-- Database should hold no unverified hadith in public endpoints.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS source_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    display_name text NOT NULL,
    original_url text NOT NULL,
    dataset_url text,
    license_reference_url text,
    permission_status text NOT NULL DEFAULT 'candidate'
      CHECK (permission_status IN ('candidate','approved','rejected')),
    permission_notes text,
    checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hadiths (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid NOT NULL REFERENCES source_catalog(id),
    collection_slug text NOT NULL,
    hadith_number text NOT NULL,
    numbering_scheme text NOT NULL,
    book_name text NOT NULL,
    chapter_name text,
    narrator text,
    arabic_text text NOT NULL CHECK (length(trim(arabic_text)) > 0),
    indonesian_text text NOT NULL CHECK (length(trim(indonesian_text)) > 0),
    translation_attribution text NOT NULL,
    reference_url text NOT NULL,
    grading_text text,
    grading_attribution text,
    grading_source_url text,
    topic_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
    verification_status text NOT NULL DEFAULT 'draft'
      CHECK (verification_status IN ('draft','review','verified','rejected')),
    verified_by text,
    verified_at timestamptz,
    content_hash char(64),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(source_id, collection_slug, numbering_scheme, hadith_number),
    CHECK ((grading_text IS NULL AND grading_attribution IS NULL AND grading_source_url IS NULL)
       OR (grading_text IS NOT NULL AND grading_attribution IS NOT NULL AND grading_source_url IS NOT NULL)),
    CHECK (verification_status <> 'verified' OR (verified_at IS NOT NULL AND verified_by IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS hadith_embeddings (
    hadith_id uuid PRIMARY KEY REFERENCES hadiths(id) ON DELETE CASCADE,
    model_id text NOT NULL,
    content_sha256 char(64) NOT NULL,
    embedding vector(1024) NOT NULL,
    indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hadiths_pub_filter ON hadiths(source_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_hadiths_fts_simple ON hadiths USING gin (
  to_tsvector('simple', indonesian_text || ' ' || book_name || ' ' || coalesce(chapter_name,''))
);
CREATE INDEX IF NOT EXISTS idx_hadiths_trgm ON hadiths USING gin (indonesian_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hadiths_source_ref ON hadiths(collection_slug, hadith_number);
-- For small verified corpora use exact vector scan. Add HNSW later only after benchmarking storage/query costs.

COMMIT;
