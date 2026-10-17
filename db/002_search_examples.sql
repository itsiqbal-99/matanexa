-- EXAMPLES for coding agent: use PARAMETERIZED `pg` query bindings.
-- $1 = text normalized; $2 = limit; $3 = offset; $4 = optional text[] collection slugs
-- These are candidate queries; implement filtering/pagination in Nest repository and test plans.

-- Lexical: word hits + trigram support; never returns unverified or license-uncleared hadiths.
SELECT h.id, h.collection_slug, h.hadith_number, h.numbering_scheme,
       h.book_name, h.indonesian_text, h.reference_url,
       ts_rank_cd(
         to_tsvector('simple', h.indonesian_text || ' ' || h.book_name || ' ' || coalesce(h.chapter_name,'')),
         websearch_to_tsquery('simple', $1)
       ) AS lexical_rank,
       similarity(h.indonesian_text, $1) AS typo_rank
FROM hadiths h
JOIN source_catalog s ON s.id = h.source_id
WHERE h.verification_status='verified'
  AND s.permission_status='approved'
  AND ($4::text[] IS NULL OR h.collection_slug = ANY($4))
  AND (
    to_tsvector('simple', h.indonesian_text || ' ' || h.book_name || ' ' || coalesce(h.chapter_name,''))
       @@ websearch_to_tsquery('simple', $1)
    OR h.indonesian_text % $1
  )
ORDER BY lexical_rank DESC, typo_rank DESC, h.collection_slug, h.hadith_number
LIMIT $2 OFFSET $3;

-- Semantic: $1 must be 1024 finite floating-point values serialized to pgvector literal by trusted backend code.
-- $2 = limit, $3 = optional text[] slugs; model filter binds model exactly.
SELECT h.id, h.collection_slug, h.hadith_number,
       (e.embedding <=> $1::vector) AS cosine_distance
FROM hadith_embeddings e
JOIN hadiths h ON h.id = e.hadith_id
JOIN source_catalog s ON s.id = h.source_id
WHERE e.model_id='@cf/baai/bge-m3'
  AND h.verification_status='verified'
  AND s.permission_status='approved'
  AND ($3::text[] IS NULL OR h.collection_slug = ANY($3))
ORDER BY e.embedding <=> $1::vector ASC, h.collection_slug, h.hadith_number
LIMIT $2;
