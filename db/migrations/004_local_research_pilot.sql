-- Explicitly authorized development-only research scope. Publication rules stay unchanged.
ALTER TABLE source_catalog DROP CONSTRAINT source_catalog_permission_status_check;
ALTER TABLE source_catalog ADD CONSTRAINT source_catalog_permission_status_check
  CHECK(permission_status IN ('candidate','approved','rejected','research_only'));
CREATE VIEW local_pilot_hadiths AS
  SELECT h.*,c.slug AS collection_slug,c.name AS collection_name,
    s.slug AS source_slug,s.display_name AS source_name,s.original_url AS source_url,
    s.attribution AS source_attribution,s.license_name,s.license_reference_url,
    ARRAY[]::text[] AS topic_slugs,true AS is_research_only
  FROM hadiths h JOIN source_catalog s ON s.id=h.source_id
  JOIN hadith_collections c ON c.id=h.collection_id
  WHERE s.permission_status='research_only' AND h.verification_status IN ('draft','review')
    AND NOT h.is_simulation AND h.raw_record->'provenance'->>'pairingStatus'='identity_matched';
