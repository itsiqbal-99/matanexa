# 05 — Hybrid Retrieval Specification

## Search modes
- `mock`: fixture UI with synthetic labeled placeholders, zero DB / zero AI. For G0/G1.
- `lexical`: requires database verified+approved records; normalize query and use PG full-text + trigram. For G2/G3.
- `hybrid`: lexical + semantic rank fusion; AI uses Cloudflare Workers AI BGE-M3 REST from NestJS. For G4.
- Any AI failure in `hybrid` => lexical fallback and `modeUsed='lexical_fallback'`. Database failure => 503, not fake data.

## Text normalization
NFKC normalization, trim, collapse whitespace, remove/control disallowed chars and input max 300 chars. Use conservative synonym map curated as data (`makan pakai -> makan dengan`, `kanan -> tangan kanan` ONLY when context warrants it); no LLM generated semantic tags. Store versioned synonym dictionary.

## Lexical path
Query candidates with `websearch_to_tsquery('simple', q)` over `to_tsvector('simple', coalesce(indonesian_text,'') || ' ' || coalesce(book_name,'') ... )`, plus trigram `similarity` over searchable Indonesian text; use `pg_trgm` extension. No built-in Indonesian stemming assumed. Collect up to 100 candidates; protect against pathological scans with input/timeout. Filtering by source slug only among approved sources.

## Semantic path
- Index **the same model for corpus and query**: `@cf/baai/bge-m3`, dimensionality 1024.
- Embedding text should be Indonesian translation + verified book/chapter labels + curated topic tags (with field labels); exclude unreconciled/uncleared content.
- `ContentHash = sha256(model + normalized source text)`; skip same-hash entries; if source edits -> reindex.
- Nest calls `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/baai/bge-m3`, JSON `{ "text": ["..."] }` with Bearer API token. Validate response `success`, vectors list, each numeric, 1024 dims, finite, and cap token/input size.
- For <=500 source records, exact cosine scan `embedding <=> queryVector` is fine. Add ANN indexes only when corpus grows and evaluation warrants it.

## Rank fusion
Use **Reciprocal Rank Fusion** over top-100 lexical and top-100 vector candidates: `rrf(d)=1/(60+rank_lexical)+1/(60+rank_semantic)` (omit terms when absent), deterministic tie-break by source and number. Do not convert this into fake 'percentage accuracy'. Preserve full pagination logic (ensure retrieval depth covers first pages or document search limitations).

## Result count and recall
- Default `limit=10`, max `limit=20`, page=1+, max page reasonable (e.g. 10) to prevent expensive deep paging.
- Limit result corpus at approved/verified; prompt 'semua hadits terkait' must not imply 100% recall.
- Benchmark manually labeled expected hadith IDs from `tests/search-evaluation.csv`; track Recall@10 and MRR@10, not just screenshots. Before labels exist, report metrics as unavailable rather than fabricate.

## Edge conditions
0 results, typo, multilingual/Arabic text, quotes, repeated query, duplicate source hadith, nonexistent reference, timeout/quota/no response, DB down, and partial embeddings. Hybrid must work on partly embedded corpus using lexical candidates.
