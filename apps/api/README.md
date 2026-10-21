# @matanexa/api

NestJS REST, TypeScript strict, controller → service, prefix `/api/v1`.
Dari root: `npm run dev --workspace @matanexa/api`, atau `npm run dev`
untuk kedua aplikasi. Workspace npm menjadikan folder ini working directory
sehingga dotenv memuat `.env` lokal. Salin `.env.example` menjadi `.env`.

- `PORT`: integer 1–65535, bawaan 4000; bind `127.0.0.1`.
- `APP_SEARCH_MODE`: `mock` (tanpa DB) atau `lexical` (Neon via pg). Hybrid belum aktif.
- `DATABASE_URL`: backend saja; lexical wajib URL Neon TLS terverifikasi.
- `DB_POOL_MAX`: 1–3; `DB_TIMEOUT_MS`: 100–10000, default 5000.
- `CORS_ORIGINS`: daftar dipisahkan koma, HTTP localhost dengan port eksplisit.
  Bawaan `http://localhost:3000,http://127.0.0.1:3000`; tanpa wildcard/credentials.
- `RETRIEVAL_TIMEOUT_MS`: 100–30000, default 10000; batas eksekusi tool internal.
- `RETRIEVAL_MAX_OUTPUT_BYTES`: 16384–1048576, default 262144; exact evidence
  gagal bila melebihi batas dan tidak dipotong diam-diam.

Phase 3 menambah `RetrievalGateway` dan empat tool internal allowlisted untuk
search/detail/related/validasi citation. Tidak ada route retrieval/conversation
baru. Adapter memakai `SearchService`/`HadithRepository` existing; mock placeholder
tidak pernah menjadi evidence dan scope public menolak research-only fail-closed.

Phase 4 menambah `ConversationOrchestratorService` internal tanpa controller atau
route baru. Konfigurasi bounds: `ORCHESTRATION_MAX_CONTEXT_CHARS` (2000–60000),
`ORCHESTRATION_MAX_OUTPUT_BYTES` (4096–262144),
`ORCHESTRATION_MAX_TOOL_EXECUTIONS` (2–6), dan
`ORCHESTRATION_MAX_OUTPUT_TOKENS` (64–2048). Default LLM tetap `disabled`.

Phase 5 menambah route JSON/SSE internal `/api/v2/internal/conversations` di atas
orchestrator yang sama. Route default nonaktif, hanya boleh aktif di
development/test, dan memerlukan `X-Matanexa-Internal-Key`. Production config
ditolak. SSE membuffer answer/reference sampai citation gate selesai serta memberi
label `buffered_validated`, bukan provider-native token streaming. Lihat
`../../docs/PHASE5_API_DESIGN.md` dan `../../docs/PHASE5_STREAMING_CONTRACT.md`.

`GET /api/v1/health` mengembalikan
`{"status":"ok","mode":"mock","databaseConfigured":false}`.
Health hanya liveness aplikasi; bukan readiness DB. G1 juga menyediakan
`POST /api/v1/search`, `GET /api/v1/sources` dan `GET /api/v1/hadiths/:id`.
Sources mock kosong; detail UUID mock 404. Sources/detail/search lexical membaca
view approved+verified; draft dan simulasi tersembunyi. Gangguan DB => safe 503.
Error HTTP memakai `{error:{code,message,requestId}}` tanpa stacktrace publik.

Perintah root per workspace: `npm run lint --workspace @matanexa/api`,
`npm run typecheck --workspace @matanexa/api`, `npm test --workspace @matanexa/api`,
`npm run build --workspace @matanexa/api`. Test membangun API lalu menjalankan
HTTP server sementara pada port acak dan menutupnya. Tes memeriksa health,
preflight/origin CORS, safe 404, konfigurasi invalid, mock matching, normalisasi,
DTO invalid, pagination, dan field sumber mock yang wajib null.

`npm run start --workspace @matanexa/api` menjalankan hasil build lokal.
G1 menggunakan Zod pipe untuk DTO strict: query 3–300 codepoint sesudah
normalisasi NFKC, page 1–10, limit 1–20 dan optional sourceSlugs unik. Respons
memakai envelope `data/meta` kit. Contoh:

```json
{ "query": "Minta dong hadits tentang berbakti kepada orang tua", "limit": 10 }
```

Topik mock: ilmu, orang tua, marah, makan, lisan, sedekah, masing-masing dua
contoh. Filter `mock-a` / `mock-b` adalah koleksi simulasi; filter lain menghasilkan
hasil kosong. Tidak ada random matching atau semantic search. `citation.number`
bernilai penanda `MOCK`; `hadithNumber` tetap null. Teks Arab, terjemahan, derajat,
dan URL sumber null; isVerified false. Tidak ada hadits nyata di repository ini.

Cache incremental disk dinonaktifkan untuk API kecil ini; direktori web dan
artefak tes tidak disertakan dalam directory watch. Hentikan watcher sebelum
build/test API yang menulis dist. Penggunaan migration/import/test DB/recovery
ada di ../../docs/DATABASE.md. Corpus nyata belum tersedia; lihat DATASET_AUDIT.md.

G3 memisahkan QueryNormalizer, QueryAnalyzer, SynonymService, SearchRepository
dan RelevanceRanker. Input asli tetap pada data.query; normalisasi/alias,
stopword, negasi, FTS/frasa/kata/topik/trigram dan dedup hanya di backend.
queryStatus=ambiguous meminta klarifikasi tanpa menutupi database error.
Tidak ada score atau diagnostics ranking dalam payload publik. Rincian dan
evaluasi 64 fixture: ../../docs/SEARCH_ENGINE.md dan ../../docs/G3_REPORT.md.
