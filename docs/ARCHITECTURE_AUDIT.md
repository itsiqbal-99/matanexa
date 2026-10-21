# Matanexa vNext — Architecture Audit

Tanggal audit: 21 Oktober 2026. Tahap: audit dan blueprint saja.

## Ringkasan eksekutif

Checkout lokal dan `origin/main` yang diperiksa secara read-only sama-sama menunjuk
commit `077b4a216756d2a1a895fef0105718311906e99c` (`refine UI`). Audit ini memakai
source pada commit tersebut, bukan menganggap laporan historis selalu sama dengan
implementasi. Working tree sejak awal memiliki perubahan milik pengguna pada
`package-lock.json` (23 baris tambah, 1 hapus); perubahan itu tidak disentuh.

Matanexa saat ini adalah modular monolith kecil dengan dua aplikasi yang terpisah
secara runtime:

- Next.js App Router hanya menangani UI, HTTP client, state, dan localStorage.
- NestJS menangani endpoint, validasi, retrieval, database, dan provider embedding.
- PostgreSQL/pgvector menyimpan corpus, provenance, status publikasi, dan vector.
- Cloudflare Workers AI hanya dipakai untuk embedding BGE-M3; belum ada LLM.

Fondasi retrieval dan integritas evidence sudah cukup baik untuk dipertahankan.
Namun, target vNext belum tersedia: tidak ada conversation domain, LLM provider
contract, orchestration, citation validator untuk jawaban generatif, SSE, normalized
generation events, server-side telemetry, production security profile, CI/CD, atau
deployment configuration.

Kesimpulan readiness:

| Area                     | Kondisi aktual                                           | Kesiapan vNext              |
| ------------------------ | -------------------------------------------------------- | --------------------------- |
| Pemisahan web/API        | Jelas dan teruji                                         | Tinggi                      |
| Publication guard        | View DB memusatkan approved + verified + non-simulation  | Tinggi, wajib dipertahankan |
| Lexical/hybrid retrieval | Berfungsi, teruji, tetapi concrete implementation        | Sedang                      |
| Provider portability     | Cloudflare embedding concrete class/model                | Rendah                      |
| Conversation/multi-turn  | Snapshot query independen di localStorage                | Rendah                      |
| Grounded generation      | Tidak ada LLM atau answer generation                     | Belum ada                   |
| Streaming                | Presentational text reveal, bukan provider stream        | Belum ada                   |
| Production security      | Lokal-only, validasi dasar kuat                          | Rendah untuk cloud          |
| Deployment/CI            | Sengaja tidak ada                                        | Belum ada                   |
| Data publik              | 0 approved/verified public corpus menurut bukti terakhir | Blocker absolut             |

## Ruang lingkup dan metode

Yang diperiksa:

- seluruh source TypeScript aplikasi;
- package/workspace configuration dan lockfile state;
- SQL desain, lima executable migrations, importer, indexer, dan pilot tooling;
- OpenAPI, response validation frontend, dan environment templates;
- unit, HTTP, integration, browser, dan pilot test definitions;
- `AGENTS.md`, `TASKS.md`, README, ADR-001–006, dan laporan teknis di `docs/`;
- keberadaan konfigurasi CI/deployment dan pola keamanan;
- environment lokal hanya pada tingkat nama key, tanpa membaca atau menyalin nilai.

Tidak dilakukan: perubahan source aplikasi, instalasi dependency, operasi database,
live provider request, pembuatan cloud resource, deployment, atau local LLM.

## Arsitektur yang berjalan

```text
Browser / Next.js :3000
  SearchWorkspace
    -> useWorkspace
      -> searchApi (POST /api/v1/search)
      -> matanexa.workspace.v1

NestJS :4000
  SearchController
    -> SearchService
      -> MockRepository                         [mock]
      -> QueryAnalyzer + SearchRepository       [lexical]
      -> CloudflareEmbedding + SemanticRepository + RRF [hybrid]
  HadithController -> HadithService -> HadithRepository
  SourcesController -> HadithService
  HealthController -> HealthService

PostgreSQL / pgvector
  source_catalog, hadith_collections, hadiths, topics, import_runs
  published_hadiths / local_pilot_hadiths
  hadith_embeddings vector(1024)
```

### Boundary web

`apps/web/app/page.tsx` merender satu client workspace. `useWorkspace.ts` membuat
satu entri `Conversation` per pencarian, tetapi entitas itu sebenarnya snapshot
query tunggal: hanya `query`, status, response, source filter, dan daftar source.
Tidak ada daftar message, hubungan parent/follow-up, tool result, atau context.

`api-client.ts` melakukan runtime validation ketat terhadap mock, verified, dan
research-only results, membatasi URL ke HTTPS, memakai timeout dan AbortController.
`storage.ts` membatasi 20 history dan 100 saved results, mempertahankan key
`matanexa.workspace.v1`, dan mencegah persistensi corpus pilot.

`AdaptiveTextReveal` adalah animasi kata atas summary yang sudah lengkap. Ini
bukan token streaming dan tidak boleh dipakai sebagai bukti SSE/provider stream.

### Boundary API

Bootstrap mengikat `127.0.0.1`, memasang prefix `/api/v1`, CORS localhost, global
exception filter, dan shutdown hooks. Environment validation menolak mode selain
mock/lexical/hybrid, membatasi pool/timeout, dan mewajibkan database pada mode real.

Layering utama sudah sesuai controller -> service -> repository/provider. Akan
tetapi `SearchService` bergantung langsung pada `CloudflareEmbedding` dan
`SemanticRepository`; belum ada port/interface provider atau retrieval planner.

Exception filter membuat request ID baru saat error. Request ID itu belum dibuat
di ingress, tidak diteruskan ke log/provider/DB, dan bukan correlation ID end-to-end.

### Retrieval aktual

Lexical path:

1. Zod memvalidasi body dan batas query.
2. `QueryNormalizer` melakukan NFKC, alias informal, bounded suffix removal, dan
   daftar typo eksplisit.
3. `QueryAnalyzer` menghasilkan primary/equivalent/related/topic/negation signals.
4. SQL melakukan FTS, trigram, curated-topic matching, scoring, dedup, count, dan
   pagination.
5. Hanya relation yang dipilih `CorpusAccess` dapat dibaca.

Hybrid path:

1. readiness memeriksa keberadaan embedding dengan model/hash yang cocok;
2. lexical top-100 dan remote query embedding berjalan paralel;
3. cosine exact scan menghasilkan semantic top-100;
4. RRF `k=60` menggabungkan kedua daftar;
5. provider failure menjadi `lexical_fallback`; DB failure tetap 503.

Hardcoded vocabulary adalah retrieval aid yang dapat diaudit, bukan conversational
intelligence. Target vNext harus mempertahankannya sebagai lexical fallback, bukan
memperluasnya menjadi intent router percakapan.

### Data dan publication safety

Executable schema berada di `db/migrations`, bukan `db/001_schema.sql` historis.
`published_hadiths` hanya berisi:

- `verification_status='verified'`;
- source `permission_status='approved'`;
- `is_simulation=false`.

Pilot riset memakai status/source view berbeda, development-only, loopback/Host
guard, `no-store`, UI label, serta larangan copy/persist. Trigger mengembalikan row
yang kontennya berubah ke draft. Importer tidak dapat menetapkan approval atau
verified. Ini adalah kontrol paling penting dan harus tetap berada di database serta
repository, bukan hanya prompt atau frontend.

Embedding storage saat ini mengunci `model='@cf/baai/bge-m3'`, dimensi 1024, dan
primary key `(hadith_id, model)`. Hash-based upsert dan scope recheck sudah baik,
tetapi schema belum menampung provider/model version/collection lifecycle lintas
dimensi.

## Existing dependency map

| Node              | Bergantung pada                                                       | Catatan                                                         |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| Root workspace    | npm workspaces `apps/*`, TypeScript, ESLint, Playwright, concurrently | Belum ada workspace `packages/contracts`                        |
| `@matanexa/web`   | Next 16.4.2, React 19, Lucide, Tailwind/PostCSS, ESLint plugins       | Tidak memiliki server business route                            |
| `@matanexa/api`   | NestJS 12, Express adapter, Zod, `pg`, RxJS, dotenv                   | Tidak ada LLM SDK, throttler, helmet, ORM, atau agent framework |
| API -> database   | `pg` parameterized queries                                            | Connection validator hanya menerima host Neon                   |
| API -> Cloudflare | native `fetch` REST                                                   | Hanya embedding BGE-M3, timeout 4 detik                         |
| Web -> API        | HTTP JSON `/api/v1`                                                   | DTO/type diduplikasi manual; OpenAPI tidak menghasilkan types   |
| Tests             | Node test runner + Playwright Edge                                    | Live DB/provider suites terpisah dan credential-gated           |

`apps/web/matanexa.zip` adalah binary archive yang tracked di dalam source tree dan
berpotensi menduplikasi source atau menjadi artefak basi. Isinya tidak dijadikan
source of truth pada audit ini.

## API dan contract assessment

API v1 hanya memiliki health, sources, search, dan hadith detail. Response envelope
`data/meta` serta error envelope sudah konsisten untuk kebutuhan search. OpenAPI
masih mendeskripsikan API sebagai “Not an LLM agent” dan belum memiliki:

- conversation/message resources;
- generation request/response;
- streaming endpoint atau event schema;
- tool execution/reference events;
- provider/model execution metadata;
- idempotency/resume semantics.

TypeScript contract frontend dan backend belum shared. Runtime frontend guard
memberi pertahanan tambahan, tetapi perubahan API harus diselaraskan manual di
OpenAPI, `apps/web/features/search/types.ts`, dan serializer backend.

## Security dan privacy assessment

Yang sudah ada:

- secret hanya backend dan ignored env;
- tracked env hanya templates kosong;
- TLS verified untuk Neon;
- strict query/body DTO;
- parameterized values;
- HTTPS validation untuk source URLs;
- error response tanpa stack/credential;
- provider response size/shape/dimension validation;
- research-only loopback guard dan no-store.

Gap cloud:

- listen address hardcoded loopback;
- CORS hanya menerima HTTP localhost;
- tidak ada rate limiting;
- tidak ada explicit global request body limit/security headers;
- tidak ada ingress correlation-ID middleware;
- tidak ada provider endpoint allowlist karena endpoint masih hardcoded;
- belum ada tool allowlist atau tool argument validator;
- belum ada prompt-injection boundary dan evidence/citation output validator;
- belum ada retention/privacy policy untuk conversation;
- belum ada database role/least-privilege provisioning document;
- logging/metrics belum mempunyai schema lintas provider.

Tidak ada secret literal yang ditemukan pada tracked source melalui scan pola dasar.
File `apps/api/.env` ada secara lokal dan ignored; hanya nama key yang diperiksa.

## Verification baseline saat audit

| Perintah                                                     | Hasil aktual 21 Oktober 2026                             |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `git ls-remote origin refs/heads/main`                       | Remote `main` = commit lokal `077b4a2...`                |
| `npm ls --depth=0 --workspaces --include=prod --include=dev` | Dependency tree ter-resolve; dua workspace ditemukan     |
| `npm run lint`                                               | Exit 0, API dan web                                      |
| `npm run typecheck`                                          | Exit 0, API, Next typegen/web, dan E2E TypeScript        |
| `npm test`                                                   | Exit 0, 26 pass, 0 fail/skip                             |
| `npm run build`                                              | Exit 0, Nest build dan Next production build; `/` statis |

Live Neon/Cloudflare integration dan pilot benchmark tidak dijalankan karena audit
tidak mengizinkan operasi cloud/database serta dapat memakai kuota. E2E browser
tidak diulang: port 3000/4000 ternyata sudah dipakai instance pengguna
(`health`: hybrid, `dataScope`: local_pilot). Dua percobaan root dev berhenti aman
dengan `EADDRINUSE`; proses pengguna tidak dihentikan. Bukti E2E terakhir tetap
tersedia di laporan terdahulu, tetapi tidak diklaim sebagai run audit ini.

## Technical debt matrix

| ID    | Prioritas | Debt berbasis source                                          | Dampak                                           | Rekomendasi                                                                    |
| ----- | --------- | ------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| TD-01 | P0        | Tidak ada LLM/conversation/orchestrator                       | Visi vNext belum dapat dijalankan                | Tambah API v2 dan module conversation/AI secara incremental                    |
| TD-02 | P0        | Search bergantung langsung pada concrete Cloudflare embedding | Sulit mengganti provider/model                   | Introduce token + provider port tanpa mengubah behavior                        |
| TD-03 | P0        | Belum ada grounded-answer/citation validator                  | Risiko kutipan/referensi halusinatif             | Evidence ledger dan fail-closed citation validation sebelum output             |
| TD-04 | P0        | Corpus publik masih 0                                         | Tidak boleh meluncurkan jawaban agama publik     | Selesaikan izin dan human verification; evidence-only/empty sampai itu terjadi |
| TD-05 | P1        | Types/OpenAPI/backend serializer diselaraskan manual          | Contract drift                                   | Workspace `packages/contracts` berisi schema/type murni                        |
| TD-06 | P1        | Tidak ada normalized streaming contract/SSE                   | Tidak ada real streaming/cancel propagation      | Tambah event schema dan SSE setelah non-streaming path stabil                  |
| TD-07 | P1        | `Conversation` frontend hanya query snapshot                  | Follow-up kehilangan konteks                     | Versioned message schema dan migration reader v1                               |
| TD-08 | P1        | Environment/listen/CORS/DB host local/Neon-only               | Tidak production-ready dan belum self-host-ready | Pisahkan strict local dan production profiles; admin-configured allowlists     |
| TD-09 | P1        | Tidak ada rate limit, tool allowlist, injection defense       | Abuse dan unsafe orchestration                   | Security middleware + retrieval-only tool registry                             |
| TD-10 | P1        | Error request ID dibuat saat response                         | Tidak bisa korelasi end-to-end                   | Ingress correlation context diteruskan ke DB/provider/event                    |
| TD-11 | P1        | Embedding table fixed model/dimension                         | Migrasi model tidak portable                     | Versioned embedding collections dan additive reindex                           |
| TD-12 | P2        | Retrieval orchestration tercampur di `SearchService`          | Sulit menguji planner/storage secara terpisah    | Port `RetrievalGateway` dengan adapter PostgreSQL                              |
| TD-13 | P2        | Global exception taxonomy berorientasi DB                     | LLM/tool/stream errors akan salah label          | Domain error codes yang stabil dan transport mapping                           |
| TD-14 | P2        | Tidak ada telemetry schema/request timing                     | Operasi provider tidak terukur                   | In-process structured metrics tanpa raw prompt                                 |
| TD-15 | P2        | `.github/workflows` dan deployment config tidak ada           | Belum ada independent CI/deploy                  | Tambah setelah local gates dan persetujuan deployment-readiness                |
| TD-16 | P2        | SQL desain historis berbeda dari migrations                   | Operator dapat menjalankan schema salah          | Tandai historical/non-executable atau arsipkan pada fase terpisah              |
| TD-17 | P2        | `apps/web/matanexa.zip` tracked                               | Duplikasi/bloat/stale artifact                   | Audit isi lalu hapus hanya dengan persetujuan eksplisit                        |
| TD-18 | P3        | JSON evaluasi besar committed                                 | Repository membesar                              | Tetapkan artifact retention policy tanpa kehilangan audit evidence             |
| TD-19 | P3        | Working tree lockfile sudah dirty                             | Baseline perubahan tidak bersih                  | Pemilik repo memutuskan commit/revert; agent tidak boleh menimpa               |

## Breaking-change analysis

| Perubahan target                             | Dampak ke existing                | Strategi kompatibilitas                                                  |
| -------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| Query independen -> message multi-turn       | Mengubah model UI/localStorage    | Pertahankan key, dual-read legacy, schemaVersion baru                    |
| Search result -> grounded assistant answer   | Kontrak response baru             | Pertahankan `/api/v1/search`; tambah `/api/v2/...`                       |
| JSON response -> SSE                         | Client/network baru               | Non-streaming endpoint tetap tersedia; normalized events versioned       |
| Concrete Cloudflare class -> provider port   | DI/test construction berubah      | Adapter pertama membungkus behavior saat ini; golden contract tests      |
| Fixed embedding model -> collections         | Schema/indexing berubah           | Migration additive, dual-read, jangan drop vector lama                   |
| Local-only -> cloud profile                  | Bootstrap/env/security berubah    | Explicit `APP_RUNTIME_PROFILE`; default tetap local/fail-closed          |
| Independent query history -> message history | Privacy/retention berubah         | Client-side persistence dulu; server persistence ditunda tanpa auth need |
| No generative content -> AI explanation      | Perubahan risiko produk/keagamaan | Kutipan immutable, explanation terpisah, citation validation fail-closed |

## Architecture readiness assessment

Layak dipakai sebagai fondasi: monorepo, strict TypeScript, boundary web/API,
Nest layering, parameterized SQL, publication view, provenance model, lexical/
semantic retrieval, hash indexing, fallback, abort, dan test discipline.

Belum layak diimplementasikan sekaligus sebagai “agent”: kontrak aktif masih
melarang LLM/multi-turn/streaming, data publik kosong, provider abstraction belum
ada, dan security/deployment profile belum dirancang di code. Migrasi harus
menambah capability satu per satu sambil mempertahankan `/api/v1` dan publication
guard. Rencana detail ada di dokumen blueprint dan migration plan.
