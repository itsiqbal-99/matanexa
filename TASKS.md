# TASKS — Gates lokal, wajib urut

**Status awal seluruhnya unchecked.** Laporkan bukti tiap gate. Jangan lompat deployment.

## G0 — Audit spesifikasi & setup

- [x] Baca seluruh file kit; buat keputusan dependency & lockfile (Node LTS terbaru yang kompatibel).
- [x] Validasi Node/npm di laptop; gunakan npm workspaces, dokumentasikan kebutuhan.
- [x] Buat `apps/web`, `apps/api`, `packages/contracts` jika dibutuhkan; root scripts `dev, build, lint, typecheck, test`.
- [x] Tambah `.env.example`, `.gitignore`, README per app, ESLint dan format.
- **Lulus:** kedua server hidup via `npm run dev`, endpoint health menyala.
- **Bukti G0 (16 Oktober 2026):** lint/typecheck/test/build lulus; 2 tes fondasi lulus; root `npm run dev` menjalankan web 3000 dan API 4000; smoke test HTTP 200 + Tailwind + health + CORS lulus. Lihat `docs/G0_REPORT.md` dan `decisions/ADR-002.md`. Status G1 ada pada gate berikut.

## G1 — UI dan Mock e2e

- [x] Implementasi desktop/mobile chat UI dari `assets/chat-ui-reference.png` (bukan copy branding).
- [x] Empty/new chat, input, enter-to-send, clear, daftar mock, filter, detail modal/sheet, copy, save local, history local.
- [x] Mock data **tanpa klaim hadits asli**; tampilkan label 'Konten contoh — bukan hadits terverifikasi'.
- [x] Skeleton/loading, no results, API error, keyboard focus dan dark/light theme.
- **Lulus:** screenshot desktop/mobile dan tes interaksi; tidak memerlukan internet/DB/token AI.
- **Bukti G1 (16 Oktober 2026):** 12 e2e desktop/mobile lulus; 5 unit/integration API lulus; lint, typecheck aplikasi + e2e, build, format dan audit akhir lulus (0 vulnerabilities). Root dev dan 4 smoke HTTP lulus setelah restart. Screenshot 1440/390/360px, laporan kegagalan/perbaikan dan daftar file tersedia di `docs/G1_REPORT.md`, `docs/evidence/` dan `decisions/ADR-003.md`. G2 tidak dikerjakan.

## G2 — NestJS real API dan database schema

- [x] Modul health, sources, hadiths, search; DTO dan validation pipe (HTTP mock, DB double dan HTTP lexical Neon terhadap corpus kosong teruji).
- [x] Migrasi SQL dan demo `draft` SIMULASI ke schema database test terisolasi; **tidak lolos filter publik**, schema dibersihkan setelah tes.
- [x] Implementasi `pg` repository, filter approved+verified+non-simulation, pagination (SQL runtime Neon dan client double teruji).
- [x] Integrasi UI dengan NestJS melalui kontrak API mock; payload lexical melalui browser fixture. Hasil nyata menunggu corpus.
- [x] Migration runner berversi/checksum/transaksi dan import idempotent tervalidasi melalui client doubles.
- [x] Audit dataset diperbarui G2.5: 4 kandidat pending_review; 0 sumber approved, 0 record nyata diimpor.
- [x] UI kompatibel payload lexical: RTL, nomor/skema, provenance, URL dan grade bersyarat; fixture browser teruji.
- [ ] Koneksi Neon, migration, import dan lexical end-to-end nyata dengan corpus berizin/verified.
- **Kriteria lulus (belum terpenuhi):** seluruh endpoints memberi struktur benar; status pending tidak bocor pada database nyata, injection tests aman, corpus berizin dan diperiksa tersedia.
- **Bukti terbaru 17 Oktober 2026:** koneksi TLS dan migrasi 001–003 terpasang; 17 unit/HTTP serta 3 integrasi Neon passed, 0 skipped. Audit sesudah tes: sumber/real/simulasi/publik semuanya 0. Kegagalan credentials pada run awal G2 sudah teratasi; laporan historis tetap di `docs/G2_REPORT.md`. Corpus berizin/verified belum ada, jadi G2 belum lulus gate data nyata. Kelanjutan G2.5/G3 dengan fixture diizinkan eksplisit oleh pengguna; G4 tidak dikerjakan.

## G2.5 — Akuisisi dataset dan persiapan evaluasi

- [x] Audit read-only koneksi, migrasi, struktur dan jumlah corpus; `db:audit` menghasilkan `docs/G25_DATABASE_AUDIT.json`.
- [x] Audit empat kandidat wajib; asal/metadata/penomoran/izin dan ketidakpastian dicatat di `docs/DATASET_AUDIT.md`.
- [x] Gunakan fallback fixture berlabel SIMULASI karena izin corpus nyata belum terbukti; tidak masuk jalur publik.
- [x] Validasi pipeline idempotent/transaksi/provenance, dry-run rollback dan field invalid dengan unit serta PostgreSQL nyata.
- [x] Siapkan 64 query asli dan judgment relevan/sebagian/tidak relevan; actual verified hadith IDs tetap null.
- [x] Jalankan evaluation runner dan simpan baseline, metrik, kategori, hash serta hasil per query.
- [x] Pisahkan laporan legalitas, integritas dan verifikasi ilmiah; cross-check nyata 0, mismatch/missing/nomor N/A.
- [x] Lint, typecheck, build, unit dan integrasi database lulus; laporan di `docs/G25_REPORT.md` dan `docs/G3_REPORT.md`.
- [ ] Pilot 100–300 nyata berizin, cross-check independen dan verifikasi manusia — **blocked**, bukan dipenuhi oleh fixture.
- **Status:** G2.5 selesai melalui jalur simulasi yang diizinkan; kesiapan data nyata G4 belum terpenuhi.

## G3 — Lexical retrieval

- [ ] Masukkan **hanya data izin jelas & diperiksa**, 50–100 atau sebanyak yang tervalidasi; bila tidak tersedia jangan memaksa.
- [x] Implementasi FTS PostgreSQL `simple`, `pg_trgm`, normalisasi konservatif, negasi, sinonim setara dan perluasan topik yang bisa diaudit.
- [x] Ranking multi-sinyal, metadata bab/topik, dedup identitas, pagination, filter, empty/ambiguous dan error DB jelas.
- [x] Nest DI modular; query asli, mode mock/lexical dan kontrak API dipertahankan; tanpa LLM/embedding.
- [x] Evaluasi 64 query JSON berlabel SIMULASI dengan graded qrels, 48 kalibrasi/16 holdout, tiga profil bobot, kategori dan EXPLAIN ANALYZE.
- [x] Baseline fixture G2/G3 terdokumentasi; P@5 0.8800, MRR@10 0.9909, Hit@5 1.0; **bukan metrik hadits nyata**.
- [x] Unit/HTTP 17 dan integrasi Neon 3 lulus; lint/typecheck/build lulus.
- [x] Regresi browser 18 desktop/mobile dan 4 smoke pada root dev final lulus; screenshot dan audit credentials tersedia, format final lulus.
- [ ] Evaluasi CSV kit dengan hadith IDs nyata setelah corpus/rujukan diverifikasi — **blocked**; jangan mengisi ID fiktif.
- **Status:** implementasi dan evaluasi teknis G3 selesai dengan fixture; gate hasil keyword nyata tetap blocked. Detail, contoh query dan batas metrik di `docs/G3_REPORT.md`. G4 belum layak dimulai dengan data nyata.

## G4 — Embedding dan hybrid retrieval

Komponen provider/vector/RRF/fallback ditambahkan dalam pilot G2.6 atas permintaan
pengguna. Gate G4 penuh tetap belum lulus; tidak menganggap fallback sebagai
perbandingan semantic nyata.

- [x] Cloudflare REST provider di NestJS, deteksi shape respons 1024, abort timeout; satu retry transient hanya saat indexing, bukan query (G2.6 hybrid teruji).
- [x] Skrip indexing batch idempotent: published tetap approved+verified; pilot research_only hanya development atas instruksi pengguna. Model/hash, resume, throttle; 404 indexed, ulang 0 request.
- [x] SQL vector cosine, lexical candidate top100, fusion RRF k=60 dengan parameter terdokumentasi dan filter scope/hash yang sama.
- [ ] Cache singkat dalam proses optional, bukan requirement.
- [x] Jatuh balik ke lexical jika AI gagal, tanda mode jujur; timeout nyata pada benchmark dan tiga kasus HTTP terkontrol lulus, DB gagal tetap 503.
- **Lulus:** tes fixture provider, A/B query semantik dan 30 benchmark; tidak ada model lokal.

## G5 — QA dan local sign-off

- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` semuanya lulus.
- [ ] Tes desktop/mobile/aksesibilitas/keyboard, empty/load/error dan timeout cloud.
- [ ] Uji semua endpoint dengan teks Indonesia/Arab, panjang input, injeksi, duplicate.
- [ ] Bukti semua hasil real berasal dari tabel verified+approved.
- [ ] Susun `LOCAL_HANDOFF.md` berisi URL lokal, langkah setup, laporan pengujian, keterbatasan.
- **Lulus:** user bisa mengetik pertanyaan sehari-hari dan melihat daftar sumber nyata (sesuai korpus yang sudah lolos audit).

## G6 — Tertunda

- [ ] **Deployment production** — sengaja di luar pekerjaan saat ini. Jangan dikerjakan tanpa instruksi baru.

## G2.6 — Pilot pencarian hadits nyata lokal (instruksi terbaru)

- [x] Akuisisi pinned ind-bukhari + ara-bukhari, provenance per record dan pairing identitas; 417 dipilih, 13 ditolak, 404 draft research_only diimpor.
- [x] Dry-run committed false, import pertama 404, ulang import skipped 404 / failed 0.
- [x] View penelitian terpisah; default published tetap approved+verified, 0 corpus publik dan 0 sumber approved.
- [x] Lexical natural language dan perbaikan indeks dialog bersarang; teks asli serta grade tidak dibuat/diubah AI.
- [x] Provider BGE-M3 REST, pgvector 1024, RRF dan fallback tersedia; 23 unit/HTTP lulus termasuk timeout/invalid/provider error dan DB error bukan fallback.
- [x] Integrasi pasangan sumber, scope lokal/publik dan anchor dengan PostgreSQL nyata lulus pada revisi final (5 tes; audit 404/404 teks/hash identik).
- [x] Sepuluh query nyata: judgment beralasan, Hit@5 1,0 / MRR@10 0,9333 lexical dan fallback serta latency didokumentasikan; bukan benchmark holdout.
- [x] Demo Next.js → NestJS → database pada localhost desktop/mobile teruji (2 tes pilot, masing-masing 3 anchor; 18 regresi mock dan 4 smoke lulus).
- [x] Lint, typecheck dan build final lulus; laporan serta daftar file diperbarui. Format final diperiksa melalui format:check.
- [x] A/B hybrid semantic nyata setelah otorisasi lanjutan: 404 embeddings, benchmark 30 pertanyaan; run akhir 29 hybrid +1 lexical_fallback (TIMEOUT).
- [ ] Izin publikasi dan tinjauan manusia independen seluruh corpus — belum selesai; tidak ada perubahan otomatis menjadi approved/verified.

**Status G2.6:** jalur lexical/fallback awal teruji; tindak lanjut hybrid nyata
diizinkan dan diindeks. Benchmark akhir Hit@5 0,6333→0,8000, MRR@10
0,5087→0,6094 (hybrid termasuk satu fallback); p95 hybrid 7,84 detik. G2/G3 gate
publik dan G4 penuh tidak diklaim lulus karena izin/verifikasi data belum selesai.
Bukti awal: docs/G26_REPORT.md dan G26_RESULTS.json. Bukti hybrid:
docs/G26_HYBRID_REPORT.md dan G26_HYBRID_RESULTS.json.

## G2.6 — Tindak lanjut Cloudflare hybrid

- [x] Validasi koneksi REST nyata tanpa mencetak kredensial; model @cf/baai/bge-m3, 1024 dimensi.
- [x] Index 404 berhasil / 0 gagal / 0 retry, 101 request; repeat skipped 404 dengan 0 request. Neuron indexing yang dilaporkan 135,9783.
- [x] Audit 404 vector/hash terkini; 404 pasangan teks tetap asli/draft, 0 approved dan 0 publik.
- [x] Benchmark 30 natural query (10 lama +20 parafrasa yang dibekukan sebelum hasil) dan laporan relevansi, regresi serta latency/usage jujur.
- [x] 26 unit/HTTP dan 6 integrasi nyata lulus, termasuk live query, fallback provider, deep pagination, DB503 dan isolasi vector public.
- [x] Browser desktop/mobile memastikan mode hybrid nyata untuk 3 anchor per viewport, pasangan asli, RTL, label dan pembatasan copy/save/persistensi (2 tes lulus).
- [x] Lint, typecheck dan build akhir lulus pada perubahan hybrid; laporan final diperbarui, format diperiksa melalui format:check.
- [ ] Izin publikasi, tinjauan manusia dan qrels independen untuk gate data G4/G5 — masih pending.

## UI — Redesign dan motion (17 Oktober 2026)

- [x] Redesign shell, sidebar, hero, topik, composer, hasil dan dialog dengan palet navy/cobalt/cyan; tanpa dependency baru.
- [x] Motion halaman, sidebar, dialog, kartu, status typing/search ring/dots/skeleton; teks hadits tetap asli dan tanpa jawaban generatif.
- [x] Reduced motion dinamis, timer cleanup, cancel, keyboard, focus trap/restore, sidebar inert dan target sentuh mobile diperiksa.
- [x] Tema terang/gelap serta layout 360–1920px diperiksa; tidak ada overflow horizontal dan composer tetap terlihat.
- [x] 20 regresi desktop/mobile lulus; 4 pemeriksaan ulang loading/motion dan 2 regresi posisi dialog lulus.
- [x] 2 tes hybrid pilot nyata lulus: 5376, 6116, 5971 pada desktop/mobile, teks berpasangan, RTL, label dan pembatasan riset tetap berlaku.
- [x] Lint, typecheck, 26 tes API dan build lulus; web build/typecheck diulang setelah koreksi CSS terakhir.
- [x] Pemeriksaan format akhir laporan/checklist selesai.
- **Status:** implementasi UI teruji; laporan `docs/UI_REDESIGN_REPORT.md`. Tidak ada deployment. Redesign ini tidak menyelesaikan hardening G4, izin publikasi atau sign-off G5.

## vNext Phase 0 — Audit dan architecture blueprint (21 Oktober 2026)

- [x] Verifikasi checkout lokal dan remote `main` pada commit `077b4a2`; audit source aktual, dependency, contracts, migrations, tests, ADR, dan reports.
- [x] Susun architecture audit, technical-debt matrix, breaking-change analysis, dependency map, dan readiness assessment.
- [x] Susun target modular monolith, provider/capability design, conversational engine, retrieval portability, topology, cloud-to-local strategy, migration plan, dan test strategy.
- [x] Buat ADR-007–009 dan terima sebagai **Accepted** setelah persetujuan pengguna.
- [x] Baseline audit: lint, typecheck, 26 unit/HTTP tests, dan production build lulus.
- [x] Persetujuan pengguna atas blueprint dan ADR diterima sebelum perubahan Phase 1.
- [x] `IMPLEMENTATION_REPORT.md` dibuat setelah Phase 1 dijalankan dan diverifikasi.
- **Batas Phase 0:** tidak ada source code, dependency, database, cloud resource, billing, local model, atau deployment yang diubah. Live DB/provider test tidak dijalankan. E2E audit tidak diulang karena port 3000/4000 sedang dipakai instance pengguna hybrid/local_pilot; dua start attempt berhenti `EADDRINUSE` tanpa menghentikan proses pengguna.

## vNext Phase 1 — Contract governance dan safety foundation (21 Oktober 2026)

- [x] ADR-007–009 diterima; `AGENTS.md`, product scope, start guide, README, dan migration status direkonsiliasi.
- [x] `packages/contracts` menjadi workspace murni TypeScript/Zod; v1 search types/schema dipakai web dan API.
- [x] Kontrak konteks v2 versioned ditambahkan tanpa endpoint/runtime AI; role privileged dan metadata provider ditolak.
- [x] Correlation ID dibuat di ingress dan konsisten pada header, success meta, serta error envelope.
- [x] Domain error publik dinormalisasi tanpa stack/secret; privacy, retention, logging, dan provider boundary didokumentasikan.
- [x] Contract tests 5/5 dan API unit/HTTP 26/26 lulus; lint/typecheck/build root lulus.
- [ ] Live DB/provider dan browser E2E tidak dijalankan pada Phase 1 karena tidak ada perubahan DB/provider/UI behavior; tetap menjadi gate terpisah.
- **Status historis saat gate ditutup:** Phase 1 selesai tanpa LLM, streaming, migration database, cloud resource, billing, local model, atau deployment. Phase 2 kemudian dikerjakan pada gate berikut.

## vNext Phase 2 — AI provider abstraction dan capability foundation (21 Oktober 2026)

- [x] Scope lama (embedding port) diselaraskan dengan instruksi pengguna yang menambah LLM provider foundation; ADR-008 dan migration plan diperbarui.
- [x] `EmbeddingProvider` token/descriptor/error contract diterapkan; BGE-M3, 1024 dimensi, indexing, ranking, dan lexical fallback tetap.
- [x] `SearchService` tidak mengimpor concrete Cloudflare adapter; binding terjadi di `ProviderModule`.
- [x] `LlmProvider` mendukung generate, normalized stream, cancellation, timeout, capabilities, usage, dan normalized errors.
- [x] Cloudflare REST adapter, deterministic mock LLM/embedding, serta default disabled provider diterapkan tanpa business endpoint.
- [x] Streaming/tool/structured-output capability divalidasi fail-closed; unknown model tidak mendapat optimistic capability.
- [x] Konfigurasi provider/model hanya dari server environment; future OpenAI-compatible hosted/loopback policy tersedia tanpa memasang local model.
- [x] Telemetry latency/outcome/error/usage dibatasi dan tidak menyimpan raw prompt, response, header, atau secret.
- [x] Provider contract/regression suite 35/35 API dan 5/5 shared contracts lulus; lint, typecheck, dan production build root lulus.
- [ ] Cloudflare LLM live contract — **NOT RUN**, explicit opt-in `RUN_LIVE_CLOUDFLARE_LLM=1` tidak aktif; 1 test tercatat skipped, bukan passed.
- **Status historis saat gate ditutup:** Phase 2 selesai tanpa perubahan API v1, database schema, corpus governance, frontend, atau deployment. Phase 3 kemudian dikerjakan pada gate berikut.

## vNext Phase 3 — Retrieval tool dan evidence foundation (21 Oktober 2026)

- [x] Scope migration plan diverifikasi; perluasan tool/evidence/safety dicatat di ADR-010 tanpa memindahkan conversation/tool-loop fase berikutnya.
- [x] `RetrievalGateway` provider-neutral dan PostgreSQL adapter membungkus `SearchService`/`HadithRepository` existing tanpa menyalin ranking/SQL.
- [x] Empat tool internal allowlisted memiliki Zod input strict, result limit, timeout, cancellation, correlation, output bound, dan normalized errors.
- [x] Evidence contract memuat stable record ID, exact text, reference/source/provenance, status, eligibility, dan server-issued citation ID.
- [x] Session ledger menolak duplicate, citation buatan model, record hilang/berubah, serta research-only evidence dalam public policy.
- [x] Valid/invalid/empty/missing/duplicate/research/provider/timeout/output/correlation dan API v1 regressions teruji deterministik.
- [x] Root lint/typecheck/build lulus; 52/52 tests lulus. Integrasi eksternal final: 2 passed, 0 failed, 5 skipped karena TEST_DATABASE_URL, fixture pilot ignored, dan opt-in live LLM tidak tersedia.
- [x] Design, evidence contract, ADR, implementation report, limitations, dan rollback didokumentasikan.
- [ ] Public approved+verified corpus dan external pilot/TEST_DATABASE integration lengkap — tetap blocked oleh data/credential, bukan dipenuhi fixture.
- **Status historis saat gate ditutup:** Phase 3 implementation selesai. API v1, schema database, BGE-M3/1024, RRF/ranking, public governance, frontend, LLM activation, dan deployment tidak berubah. Phase 4 kemudian dikerjakan pada gate berikut.

## vNext Phase 4 — Conversational orchestration foundation (21 Oktober 2026)

- [x] Perbedaan migration plan didokumentasikan: scope UI/localStorage/mock endpoint lama ditunda, scope backend orchestration terbaru menjadi otoritas Phase 4.
- [x] Shared conversation context/result tetap provider-independent, strict, bounded, dan hanya assistant history yang boleh membawa stable evidence record IDs.
- [x] Internal `ConversationOrchestratorService` menghubungkan `LlmProvider` dengan `RetrievalToolExecutor`; tidak ada controller, route API v2, persistence, atau inference startup.
- [x] Provider tanpa native tools memakai retrieval-first dan bounded LLM reformulation; provider native hanya melihat static allowlist dan semua argumen tetap divalidasi executor.
- [x] Evidence dikumpulkan/revalidated server-side; temporary citation ID tidak dipersist, invented/stale citation ditolak, empty/provider failure memberi no-evidence/evidence-only.
- [x] Context, timeout, tool count, output, cancellation, capability, normalized error, telemetry privacy, dan research/public isolation memiliki kontrol fail-closed.
- [x] Single-turn, tiga-turn follow-up, reformulation, topic switch, empty, invalid/stale citation, research-only, timeout/disabled, capability, cancellation, output, dan API v1 regression teruji deterministik.
- [x] Root lint/typecheck/build lulus; 65/65 tests lulus. Integrasi eksternal: 2 passed, 0 failed, 5 skipped karena TEST_DATABASE_URL, fixture pilot ignored, dan opt-in live LLM tidak tersedia.
- [x] Desain, context/evidence lifecycle, ADR-011, implementation report, limitations, dan rollback didokumentasikan.
- [ ] Semantic quality dengan model nyata dan public approved+verified corpus — **NOT RUN/blocked**; mock tidak dianggap bukti kualitas model nyata.
- **Status historis saat gate ditutup:** Phase 4 selesai sebagai backend foundation. API v1, database schema, BGE-M3/1024, RRF/ranking, corpus governance, frontend, public AI activation, local LLM, paid service, dan deployment tidak berubah. Phase 5 kemudian dikerjakan pada gate berikut.

## vNext Phase 5 — Internal conversational API dan streaming foundation (21 Oktober 2026)

- [x] Roadmap direkonsiliasi: orchestration/tool foundation Phase 5–6 lama sudah maju ke Phase 4; Phase 5 baru menjadi internal API dan safe SSE transport, dicatat di ADR-012.
- [x] Strict shared request dan enam normalized SSE event schemas menolak privileged roles, provider payload, evidence replay, temporary citation, raw vendor event, dan unknown fields.
- [x] JSON dan SSE `/api/v2/internal/conversations/turn` memakai existing `ConversationOrchestratorService`; tidak menyalin retrieval/provider/evidence logic.
- [x] Route default disabled, development/test-only, loopback-bound, access-key protected, constant-length timing-safe compare, dan production activation fail-closed.
- [x] SSE mengirim orchestration status, lalu reference/text hanya setelah citation validation; delivery ditandai `buffered_validated`, bukan native provider token streaming.
- [x] Disconnect abort, overall timeout, concurrency admission, SSE byte bound, safe errors, monotonic sequence, serta exactly-one-terminal semantics teruji.
- [x] Valid/invalid/disabled/unauthorized, grounded/evidence-only/no-evidence, multi-turn, invalid/stale citation, research isolation, timeout/cancel/output/concurrency, dan API v1 regression teruji deterministik.
- [x] Root lint/typecheck/build lulus; 74/74 tests lulus. Integrasi eksternal: 2 passed, 0 failed, 5 skipped karena TEST_DATABASE_URL, fixture pilot ignored, dan opt-in live LLM tidak tersedia.
- [x] API design, streaming contract, ADR-012, implementation report, limitations, dan rollback didokumentasikan.
- [ ] Provider-native conversational streaming, frontend reducer, real-model semantics, dan public activation — **NOT RUN/out of scope**.
- **Status:** Phase 5 selesai sebagai internal transport foundation. API v1, database schema, ranking, BGE-M3/1024, corpus governance, frontend, public AI, local LLM, paid service, dan deployment tidak berubah. Phase 6 belum dimulai dan harus direkonsiliasi ulang.

## vNext Phase 6 — Real LLM readiness dan semantic evaluation (21 Oktober 2026)

- [x] Roadmap direkonsiliasi: tool-loop historis sudah dipenuhi Phase 4; Phase 6 menjadi readiness audit, offline evaluation, grounding hardening, dan live gate melalui ADR-013.
- [x] LlmProvider, Cloudflare transport/capability/error/SSE, config/token/timeout, telemetry, orchestrator, evidence validation, dan fallback diaudit beserta risiko live yang tidak tertangkap mock.
- [x] Empat hosted candidates didokumentasikan dengan context/pricing source snapshot; tools/structured output tidak diaktifkan hanya dari klaim katalog.
- [x] Strict 16-case placeholder-only dataset mencakup formal/casual/slang/typo, follow-up, summary, source, topic switch, ambiguity, no evidence, fake citation, exact-text/status overclaim, research isolation, timeout/invalid/disabled provider.
- [x] Reproducible offline runner mengukur retrieval, context, reformulation, eligibility, citation, fallback, response contract, error, latency fields, failures, usage, dan nullable cost secara terpisah.
- [x] Exact Arabic/translation tetap server-owned; complete exact-copy dan unsupported grade/status claim gagal aman menjadi evidence-only.
- [x] Live Cloudflare probe diperketat dengan model/config, privacy, quota/cost, synthetic-only data, request/token ceiling, credentials, dan explicit inference approval gates.
- [x] Offline runner lulus 16/16; deterministic mock bukan bukti kualitas semantik atau performa model nyata.
- [ ] Cloudflare LLM contract/semantic live evaluation — **NOT RUN**, berhenti pada approval gate; tidak ada live inference, research-only transmission, paid activation, atau public AI.
- [x] Root 76/76 tests, lint final, typecheck, production builds, dan Phase 6 file formatting lulus; lint awal sempat gagal pada lima temuan runner lalu diperbaiki.
- [ ] External DB regressions — **BLOCKED/FAIL**: 2 suite mendapat HTTP 503, 5 skipped, dan `db:check` memberi `DATABASE_OPERATION_FAILED`; bukan PASS dan tidak diganti mock.
- [ ] Repository-wide `format:check` — gagal pada 101 file baseline di luar file Phase 6; unrelated user files tidak direformat massal.
- **Status:** implementation/offline harness selesai dan live LLM tetap NOT RUN, tetapi acceptance penuh belum dapat ditandai karena external database regression merah. Phase 7 tidak dimulai.
