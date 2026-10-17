-- Executed transactionally by the versioned migration runner. No vector in G2.
CREATE TABLE source_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  display_name text NOT NULL,
  original_url text NOT NULL CHECK (original_url ~ '^https://'),
  publisher text, edition text, language text NOT NULL DEFAULT 'ar-id',
  dataset_url text, license_name text, license_reference_url text,
  attribution text,
  permission_status text NOT NULL DEFAULT 'candidate'
    CHECK (permission_status IN ('candidate','approved','rejected')),
  permission_notes text, permission_evidence_url text, checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (permission_status <> 'approved' OR
    (license_name IS NOT NULL AND license_reference_url ~ '^https://' AND
     permission_evidence_url ~ '^https://' AND attribution IS NOT NULL AND
     permission_notes IS NOT NULL AND checked_at IS NOT NULL AND
     license_reference_url IS NOT NULL AND permission_evidence_url IS NOT NULL))
);
CREATE TABLE hadith_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  name text NOT NULL, original_name text, description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES source_catalog(id),
  dataset_url text NOT NULL, dataset_version text NOT NULL,
  file_sha256 char(64) NOT NULL, report jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE hadiths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES source_catalog(id),
  collection_id uuid NOT NULL REFERENCES hadith_collections(id),
  hadith_number text NOT NULL CHECK (length(trim(hadith_number)) > 0),
  numbering_scheme text NOT NULL CHECK (length(trim(numbering_scheme)) > 0),
  book_name text NOT NULL, chapter_name text, narrator text,
  arabic_text text NOT NULL CHECK (length(trim(arabic_text)) > 0),
  indonesian_text text NOT NULL CHECK (length(trim(indonesian_text)) > 0),
  normalized_translation text NOT NULL,
  translation_attribution text NOT NULL,
  reference_url text NOT NULL CHECK (reference_url ~ '^https://'),
  grading_text text, grading_attribution text, grading_source_url text,
  verification_status text NOT NULL DEFAULT 'draft'
    CHECK (verification_status IN ('draft','review','verified','rejected')),
  verified_by text, verified_at timestamptz, verification_reference_url text,
  is_simulation boolean NOT NULL DEFAULT false,
  content_hash char(64) NOT NULL,
  import_run_id uuid REFERENCES import_runs(id),
  raw_record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, collection_id, numbering_scheme, hadith_number),
  CHECK ((grading_text IS NULL AND grading_attribution IS NULL AND grading_source_url IS NULL)
    OR (grading_text IS NOT NULL AND grading_attribution IS NOT NULL AND grading_source_url IS NOT NULL
        AND grading_source_url ~ '^https://')),
  CHECK (verification_status <> 'verified' OR
    (verified_by IS NOT NULL AND length(trim(verified_by)) > 0 AND verified_at IS NOT NULL
     AND verification_reference_url IS NOT NULL AND verification_reference_url ~ '^https://'
     AND NOT is_simulation))
);
CREATE TABLE hadith_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
  name text NOT NULL, description text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE hadith_topic_relations (
  hadith_id uuid NOT NULL REFERENCES hadiths(id),
  topic_id uuid NOT NULL REFERENCES hadith_topics(id),
  PRIMARY KEY(hadith_id, topic_id)
);
-- Corrections always require fresh verification, including manual SQL corrections.
CREATE FUNCTION invalidate_hadith_verification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.source_id, NEW.collection_id, NEW.hadith_number, NEW.numbering_scheme,
    NEW.book_name, NEW.chapter_name, NEW.narrator, NEW.arabic_text, NEW.indonesian_text,
    NEW.translation_attribution, NEW.reference_url, NEW.grading_text,
    NEW.grading_attribution, NEW.grading_source_url, NEW.is_simulation)
    IS DISTINCT FROM ROW(OLD.source_id, OLD.collection_id, OLD.hadith_number, OLD.numbering_scheme,
    OLD.book_name, OLD.chapter_name, OLD.narrator, OLD.arabic_text, OLD.indonesian_text,
    OLD.translation_attribution, OLD.reference_url, OLD.grading_text,
    OLD.grading_attribution, OLD.grading_source_url, OLD.is_simulation) THEN
    NEW.verification_status := 'draft'; NEW.verified_by := NULL;
    NEW.verified_at := NULL; NEW.verification_reference_url := NULL;
  END IF;
  NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER hadith_content_changed BEFORE UPDATE ON hadiths
  FOR EACH ROW EXECUTE FUNCTION invalidate_hadith_verification();
-- All public repository queries use this view; no public status bypass.
CREATE VIEW published_hadiths AS
  SELECT h.*, c.slug AS collection_slug, c.name AS collection_name,
    s.slug AS source_slug, s.display_name AS source_name, s.original_url AS source_url,
    s.attribution AS source_attribution, s.license_name, s.license_reference_url
  FROM hadiths h JOIN source_catalog s ON s.id=h.source_id
  JOIN hadith_collections c ON c.id=h.collection_id
  WHERE h.verification_status='verified' AND s.permission_status='approved'
    AND NOT h.is_simulation;
