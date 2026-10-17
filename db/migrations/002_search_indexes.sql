CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
ALTER TABLE hadiths ADD COLUMN search_document tsvector GENERATED ALWAYS AS
  (to_tsvector('simple', normalized_translation || ' ' || book_name || ' ' || coalesce(chapter_name,''))) STORED;
CREATE INDEX hadith_publication_idx ON hadiths(source_id, verification_status);
CREATE INDEX hadith_collection_idx ON hadiths(collection_id);
CREATE INDEX hadith_search_idx ON hadiths USING gin(search_document);
CREATE INDEX hadith_translation_trgm_idx ON hadiths USING gin(normalized_translation gin_trgm_ops);
CREATE INDEX hadith_topic_reverse_idx ON hadith_topic_relations(topic_id,hadith_id);
-- Views defined before ALTER do not automatically expose added columns.
CREATE OR REPLACE VIEW published_hadiths AS
  SELECT h.id,h.source_id,h.collection_id,h.hadith_number,h.numbering_scheme,
    h.book_name,h.chapter_name,h.narrator,h.arabic_text,h.indonesian_text,
    h.normalized_translation,h.translation_attribution,h.reference_url,
    h.grading_text,h.grading_attribution,h.grading_source_url,h.verification_status,
    h.verified_by,h.verified_at,h.verification_reference_url,h.is_simulation,
    h.content_hash,h.import_run_id,h.raw_record,h.created_at,h.updated_at,
    c.slug AS collection_slug,c.name AS collection_name,
    s.slug AS source_slug,s.display_name AS source_name,s.original_url AS source_url,
    s.attribution AS source_attribution,s.license_name,s.license_reference_url,
    h.search_document
  FROM hadiths h JOIN source_catalog s ON s.id=h.source_id
  JOIN hadith_collections c ON c.id=h.collection_id
  WHERE h.verification_status='verified' AND s.permission_status='approved'
    AND NOT h.is_simulation;
