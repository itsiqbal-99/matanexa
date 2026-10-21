# Matanexa vNext — Retrieval Portability

Status: port/gateway dan evidence boundary Phase 3 diimplementasikan 21 Oktober
2026; versioned embedding collections tetap rencana fase berikutnya.

## Baseline yang dipertahankan

- PostgreSQL + pgvector tetap default dan satu-satunya storage implementasi.
- Lexical `simple` FTS + pg_trgm + curated signals tetap tersedia.
- Semantic exact cosine scan top-100 tetap memadai untuk corpus kecil.
- RRF `k=60`, deterministic tie break, scope filtering, dan lexical fallback tetap.
- Hash-based idempotent indexing tetap wajib.
- Public retrieval hanya melalui approved + verified + non-simulation boundary.

Tidak ada Qdrant, Milvus, Chroma, Redis, atau vector database baru pada rencana awal.

## Coupling baseline dan hasil Phase 3

- `SearchService` tetap mengorkestrasi repositories existing tetapi provider
  embedding sudah melalui port Phase 2.
- `SearchRepository` mengandung ranking policy dan PostgreSQL query besar.
- `SemanticRepository` mengimpor hardcoded model constant.
- `CorpusAccess` memilih nama relation dan repository menginterpolasikannya dari
  enum internal; aman saat ini, tetapi storage/domain boundary belum eksplisit.
- `PostgresRetrievalGateway` kini membungkus `SearchService` dan
  `HadithRepository`; future orchestration tidak menerima SQL row/table name.
- Static allowlist, strict schemas, policy isolation, evidence ledger, timeout,
  correlation, normalized errors, dan output bounds tersedia tanpa endpoint baru.

## Ports yang diimplementasikan

```typescript
interface RetrievalGateway {
  search(
    request: SearchHadithToolInput,
    options?: { signal?: AbortSignal },
  ): Promise<RetrievalPage>;
  findById(
    id: string,
    options?: { signal?: AbortSignal },
  ): Promise<RetrievalRecord | undefined>;
}

interface LexicalRetriever {
  search(
    query: AnalyzedQuery,
    filters: RetrievalFilters,
    limit: number,
  ): Promise<RankedId[]>;
}

interface SemanticRetriever {
  readiness(
    collection: EmbeddingCollectionId,
    filters: RetrievalFilters,
  ): Promise<Readiness>;
  search(
    vector: number[],
    collection: EmbeddingCollectionId,
    filters: RetrievalFilters,
    limit: number,
  ): Promise<RankedId[]>;
}

interface RankFusion {
  fuse(lists: RankedId[][], options: FusionOptions): RankedId[];
}
```

`PostgresRetrievalGateway` mengimplementasikan port melalui service/repository yang
ada. Domain tidak menerima SQL row atau table name. Retrieval result memisahkan
evidence records, mode/fallback, dan count semantics. Port
lexical/semantic/fusion yang lebih granular tetap dapat diekstrak kemudian; Phase 3
sengaja tidak menulis ulang search engine.

## Dynamic planning tanpa hardcoded language intent

Conversational planner memilih operasi abstrak seperti:

- lexical only;
- hybrid;
- hadith ID/citation lookup;
- source-filtered retrieval;
- clarification.

Natural-language intent tidak dipetakan melalui keyword list baru. Existing query
analyzer hanya digunakan ketika lexical retrieval dipilih. Planner output memakai
schema, allowlisted operations, bounded parameters, dan tidak dapat memilih relation
atau SQL.

Jika model/tool calling tidak tersedia, default yang aman adalah hybrid bila index
ready, selain itu lexical. Ambiguity tetap dapat menghasilkan clarification.

## Versioned embedding collections

Vector dari model berbeda tidak kompatibel. Identitas collection minimal:

```text
provider_id
model_id
model_revision
dimensions
normalization
distance_metric
input_template_version
created_at
status = building | active | retired | failed
```

Setiap embedding row mengacu pada collection ID dan menyimpan `hadith_id`,
`content_hash`, vector, serta indexed timestamp. Uniqueness menjadi
`(collection_id, hadith_id)`.

Current table fixed `vector(1024)` tidak boleh langsung diubah/destructive. Migrasi
yang diusulkan:

1. buat `embedding_collections` additive;
2. buat storage v2 terpisah;
3. daftarkan BGE-M3/1024 sebagai collection;
4. backfill/copy existing vectors dengan audit count/hash;
5. dual-read validation;
6. aktifkan collection melalui config/transaction;
7. pertahankan table lama sampai rollback window berakhir.

Untuk lintas dimensi pada exact scan kecil, storage v2 dapat memakai typmod-less
`vector` dengan app/DB insert validation terhadap collection dimensions. Jika ANN
kelak dibutuhkan, buat index parsial/typed per active collection setelah benchmark;
jangan membuat satu ANN index campur dimensi.

## Reindex dan rollback

```text
register collection BUILDING
  -> scan eligible evidence through same policy boundary
  -> batch embed with hash/source recheck
  -> verify counts, dimensions, finite values, sample retrieval
  -> freeze evaluation set
  -> compare quality/latency/cost
  -> mark ACTIVE atomically
  -> retain previous ACTIVE as RETIRED/rollback candidate
```

Jangan menghapus embedding lama sebelum collection baru aktif dan rollback window
selesai. Content correction membuat hash mismatch sehingga row lama tidak eligible,
tanpa harus menghapus audit history segera.

## Retrieval result semantics

`totalCandidates` current hybrid adalah jumlah gabungan candidate window, bukan
exhaustive corpus recall. vNext contract harus menamai/mendokumentasikannya jelas,
misalnya `candidateCount` + `countScope: 'retrieval_window'|'exact'` agar model/UI
tidak membuat klaim “semua hadits terkait”.

Retrieval metadata internal seperti relevance score, vector distance, atau prompt
reformulation tidak boleh dipresentasikan sebagai kebenaran/derajat hadits.

## Portability acceptance tests

- lexical adapter menghasilkan behavior v1 yang sama pada golden fixtures;
- semantic adapter menolak dimension/model/hash mismatch;
- RRF deterministik dan dedup;
- filter source/scope identik pada lexical dan semantic;
- published query tidak pernah membaca research-only vectors;
- DB error tidak berubah menjadi mock/fake answer;
- provider embedding failure tetap lexical fallback;
- active collection switch dan rollback atomic;
- mixed-model vector tidak pernah dibandingkan;
- new storage tidak menurunkan citation/provenance fields.
