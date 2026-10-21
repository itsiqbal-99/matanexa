# Matanexa vNext — Incremental Migration Plan

Status: disetujui 21 Oktober 2026. Phase 0–5 selesai dan terverifikasi; Phase 6
offline implementation selesai tetapi acceptance tertahan external DB regression.

## Prinsip eksekusi

- satu capability/risk boundary per fase;
- `/api/v1` dan current local behavior tetap berfungsi;
- migration database additive dan reversible di application layer;
- setiap fase memiliki tests, observability minimum, dan rollback;
- public data gate tidak pernah digantikan oleh mock/research corpus;
- dependency baru hanya jika kebutuhan tidak dapat dipenuhi secara wajar oleh stack
  sekarang dan mendapat persetujuan;
- deployment tetap setelah G5 dan instruksi baru.

## Phase 0 — Audit dan blueprint

Selesai pada pekerjaan blueprint.

Deliverables: audit, target architecture, provider design, conversation design,
retrieval portability, topology, cloud-to-local strategy, migration plan, test
strategy, dan ADR proposed.

Acceptance:

- source/remote commit teridentifikasi;
- current behavior dan debt berbasis file aktual;
- baseline lint/typecheck/unit/build dijalankan;
- tidak ada source/dependency/database/cloud change;
- user menyetujui atau merevisi blueprint sebelum Phase 1.

Rollback: hapus dokumen Phase 0; tidak ada runtime effect.

## Phase 1 — Contract governance dan safety foundation

Status: selesai 21 Oktober 2026. Bukti ada di `docs/IMPLEMENTATION_REPORT.md`.

Tujuan: menyelesaikan konflik kontrak sebelum menambah AI.

Perubahan:

- accept/revise ADR-007–009;
- update `AGENTS.md`, scope docs, dan TASKS secara eksplisit;
- buat `packages/contracts` dengan schemas/types murni untuk v1 existing dan v2;
- tambah correlation ID ingress dan normalized domain errors;
- dokumentasikan privacy/retention/provider data policy.

Tests:

- v1 golden HTTP responses tidak berubah;
- contract serialization roundtrip web/API;
- untrusted roles/provider metadata ditolak;
- request ID konsisten ingress -> response.

Rollback: web/API tetap memakai types lokal; package baru dapat dilepas tanpa schema
atau data mutation.

## Phase 2 — Provider abstraction tanpa behavior change

Status: selesai 21 Oktober 2026. Scope diperluas melalui instruksi eksplisit
pengguna; bukti ada di `docs/PHASE2_IMPLEMENTATION_REPORT.md`.

Tujuan: membungkus embedding existing di belakang port dan membangun LLM provider
foundation tanpa menghubungkannya ke business flow.

Perubahan:

- introduce `EmbeddingProvider` token/descriptor/error contract;
- jadikan current Cloudflare implementation adapter;
- mock adapter dan shared provider contract tests;
- model/config tetap BGE-M3/1024 dan fallback behavior tetap.
- tambah `LlmProvider` untuk generate/stream/cancellation/timeout, capability
  metadata, normalized errors/usage, dan telemetry privacy-safe;
- Cloudflare LLM REST adapter dengan model backend-configured tanpa default;
- deterministic mock LLM dan disabled provider;
- static configuration contract untuk future OpenAI-compatible adapter; tidak
  menginstal atau menjalankan Ollama/vLLM/local model.

Acceptance:

- 26 current tests dan live-gated suites tetap kompatibel;
- no extra remote calls;
- indexing count/hash/retry semantics identik;
- `SearchService` tidak mengimpor vendor class.
- provider LLM default disabled dan tidak punya endpoint bisnis;
- Cloudflare/mock lulus contract/capability/error tests yang sama;
- live Cloudflare test hanya explicit opt-in dan bounded.

Rollback: DI binding kembali ke concrete class; tidak ada DB change.

## Phase 3 — Retrieval gateway extraction

Status: selesai 21 Oktober 2026. Scope diperluas melalui instruksi eksplisit
pengguna; bukti ada di `docs/PHASE3_IMPLEMENTATION_REPORT.md`.

Tujuan: memisahkan orchestration dari PostgreSQL tanpa mengganti storage.

Perubahan:

- define retrieval/fusion/evidence ports;
- adapter PostgreSQL membungkus SQL existing;
- explicit retrieval metadata/count semantics;
- golden ordering/pagination/filter tests.
- typed search/detail/related/validation tools dengan static allowlist;
- session-scoped evidence ledger, server-side citation validation, policy isolation,
  timeout, output bound, correlation, dan normalized errors.

Perluasan di atas tidak memindahkan Phase 5 orchestration atau Phase 6 tool loop ke
Phase 3: tidak ada conversation endpoint, LLM call, dynamic loop, atau public tool
surface. ADR-010 mencatat boundary ini.

Acceptance:

- API v1 payload/order untuk frozen fixtures sama;
- DB failure/fallback/publication isolation sama;
- tidak ada alternate vector DB.
- citation buatan caller/model dan research evidence pada public policy ditolak.

Rollback: SearchService memakai repositories lama; migrations tidak diperlukan.

## Phase 4 — Backend conversational orchestration foundation

Status: selesai 21 Oktober 2026 melalui scope baru yang diotorisasi pengguna;
bukti ada di `docs/PHASE4_IMPLEMENTATION_REPORT.md`.

Perbedaan scope: rencana lama menempatkan schema/localStorage/UI migration dan mock
endpoint pada Phase 4, sedangkan instruksi terbaru meminta backend orchestration
foundation dan melarang perubahan frontend/public AI. Scope lama tersebut ditunda.
Sebagian foundation yang dahulu direncanakan pada Phase 5/6 dimajukan, tetapi tidak
ada public endpoint, activation, streaming, atau persistence. ADR-011 mencatat
supersession dan dampaknya.

Perubahan:

- perluas shared conversation context/result contracts tanpa provider payload;
- internal `ConversationOrchestratorService` di atas `LlmProvider` dan
  `RetrievalToolExecutor`;
- bounded history selection dan dynamic LLM query reformulation tanpa keyword
  intent mapping;
- deterministic retrieval-first untuk provider tanpa native tools dan allowlisted
  bounded planning untuk capability `native`;
- evidence-first generation, server citation validation, stable-record
  revalidation, evidence-only/no-evidence fallback;
- timeout, cancellation, context/tool/output bounds, normalized errors, dan
  privacy-safe telemetry.

Acceptance:

- single/multi-turn, follow-up reformulation, topic switch, empty retrieval,
  invalid/stale citation, research isolation, provider failure/disabled,
  capability, cancellation, dan bounds teruji deterministik;
- API v1 tetap sama dan tidak ada API v2/public route;
- default LLM tetap disabled dan tidak ada inference startup/test otomatis;
- tidak ada schema DB, frontend, ranking, embedding, governance, atau deployment
  change.

Rollback: lepaskan `ConversationModule`, contracts/result extension, config, dan
tests Phase 4. Retrieval/provider Phase 2–3 serta API v1 tetap berjalan tanpa data
rollback.

Catatan urutan: original frontend/localStorage Phase 4 dan public activation Phase
5 harus disusun ulang serta disetujui sebelum dikerjakan. Bagian Phase 5 di bawah
adalah target historis, bukan otorisasi otomatis.

## Phase 5 — Internal conversation API dan validated SSE foundation

Status: selesai 21 Oktober 2026 melalui scope baru yang diotorisasi pengguna;
bukti ada di `docs/PHASE5_IMPLEMENTATION_REPORT.md`. Grounded orchestration,
retrieval-first planning, tool allowlist, evidence ledger, citation validation, dan
multi-turn context sudah selesai pada Phase 2–4; pekerjaan tersebut tidak
diimplementasikan ulang.

Perbedaan scope: instruksi terbaru mengganti Phase 5 lama yang sudah sebagian besar
dipenuhi Phase 4 dengan transport internal. Fase ini juga memajukan contract dan
lifecycle SSE dari Phase 7, tetapi tidak mengklaim provider-native token streaming
atau mengubah frontend. ADR-012 mencatat urutan baru.

Perubahan:

- strict stateless internal API v2 untuk satu conversation turn;
- default-disabled, development/test-only activation dan backend access key;
- normalized sequenced SSE contract;
- orchestration status dapat dikirim langsung, sedangkan answer/reference dibuffer
  sampai evidence dan citation selesai divalidasi;
- disconnect abort, overall timeout, concurrency admission, output bound, safe
  error, dan exactly-one-terminal semantics.

Acceptance:

- JSON dan SSE memakai shared contracts serta existing orchestrator;
- disabled/unauthorized/invalid request fail closed;
- grounded/evidence-only/no-evidence dan multi-turn teruji deterministik;
- tidak ada unvalidated religious model text yang mencapai client;
- cancellation, timeout, concurrency, output bound, dan ordering teruji;
- API v1 tetap kompatibel; tidak ada DB/frontend/deployment change.

Rollback: lepaskan controller/transport service dari `ConversationModule` dan hapus
config API internal. Phase 4 orchestrator tetap internal dan API v1 tidak berubah.

## Phase 6 — Real LLM readiness dan semantic evaluation

Status: implementation dan offline harness selesai 21 Oktober 2026; acceptance
penuh tertahan external DB regression yang mendapat 503. Live inference tetap
`NOT RUN`. Bukti ada di `docs/PHASE6_IMPLEMENTATION_REPORT.md` dan ADR-013.

Rekonsiliasi: capability-aware tool loop historis tidak diulang karena static
allowlist, capability checks, validated arguments, bounded execution, dan
deterministic non-tool path sudah ada sejak Phase 4. Phase 6 baru mengaudit jalur
itu terhadap risiko model nyata, membangun dataset/runner offline, memperketat
grounding, dan menyiapkan gate live.

Perubahan:

- provider/config/capability/timeout/token/error/SSE/telemetry readiness audit;
- strict placeholder-only Indonesian multi-turn evaluation dataset;
- reproducible runner di atas orchestrator dan retrieval executor aktual;
- separated retrieval/context/reformulation/evidence/citation/fallback/contract
  checks dan measurement fields;
- exact evidence-text/status-overclaim fail-closed checks;
- hosted model shortlist dan privacy/quota/cost/request/token approval gate;
- strengthened single-request synthetic Cloudflare probe, tetap opt-in dan tidak
  dijalankan pada fase offline.

Acceptance:

- 16/16 deterministic pipeline cases dan 76/76 core regressions lulus;
- 2 configured external DB suites gagal dengan safe 503 dan 5 external tests
  skipped; acceptance “seluruh regression lulus” belum diklaim;
- mock result secara eksplisit bukan bukti semantic model quality;
- live inference `NOT RUN`, research-only external transmission dilarang;
- API v1, DB/schema, ranking, BGE-M3/1024, frontend, public AI, billing, dan
  deployment tidak berubah.

Rollback: hapus evaluation assets/scripts dan additional output-policy checks;
Phase 1–5 tetap berjalan tanpa data rollback.

## Phase 7 — Real SSE streaming

Catatan setelah Phase 5: normalized SSE contract, disconnect lifecycle, dan
buffered-validated non-streaming delivery dimajukan ke Phase 5. Scope Phase 7 yang
tersisa adalah provider-native streaming yang tetap citation-safe serta frontend
event reducer. Keduanya memerlukan persetujuan baru dan tidak dikerjakan Phase 5.

Tujuan: normalized provider-independent events.

Perubahan:

- SSE endpoint, serializer, heartbeat policy, disconnect abort;
- frontend event reducer dengan seq dedup;
- partial/final state separation;
- non-streaming fallback jujur.

Acceptance:

- native streaming dan unsupported streaming scenarios;
- cancel/disconnect propagates;
- invalid citation tidak menjadi final content;
- duplicate/out-of-order event handling;
- current presentational text reveal tidak disebut token streaming.

Rollback: disable streaming capability/endpoint; use v2 non-streaming.

## Phase 8 — Embedding collection portability

Tujuan: additive versioned collection schema dan safe reindex.

Perubahan:

- collection metadata/storage v2;
- register/backfill current BGE-M3 collection;
- dual-read validation dan atomic activation;
- reindex/rollback tooling.

Acceptance:

- dimension/model/hash mismatch rejected;
- old/new vectors never mixed;
- count/hash parity and frozen retrieval evaluation;
- old table retained through rollback window.

Rollback: point active configuration to legacy/current collection.

## Phase 9 — Production security dan observability hardening

Perubahan:

- explicit runtime profiles, production CORS/listen/HTTPS policy;
- request/body/concurrency/rate limits;
- security headers;
- endpoint SSRF validation;
- correlation metrics and privacy-safe structured logging;
- DB least-privilege role documentation/tests.

Acceptance:

- abuse, request-size, CORS, SSRF, secret leak, prompt injection tests;
- latency/error/usage/fallback/citation metrics tersedia;
- raw conversation/evidence tidak dicatat default.

Rollback: cloud profile tidak diaktifkan; local profile tetap current-safe.

## Phase 10 — CI dan deployment readiness

Hanya setelah G5 lulus dan instruksi deployment-readiness baru.

- workspace/path-aware GitHub Actions;
- environment templates;
- Cloudflare Pages compatibility spike/config;
- Render-compatible API config;
- staging, migration, smoke, rollback runbooks.

Ini belum mengotorisasi deployment sungguhan atau paid service.

## Phase 11 — Deployment

Di luar pekerjaan saat ini. Memerlukan perintah eksplisit baru, data publication
approval, G5 sign-off, security review, quota/billing confirmation, dan rollback
drill.

## Cross-phase blockers

| Blocker                                        | Fase yang berhenti                                   |
| ---------------------------------------------- | ---------------------------------------------------- |
| Blueprint/ADR belum disetujui                  | Semua implementasi                                   |
| LLM model/capabilities/privacy belum disetujui | Phase 5+                                             |
| Public corpus 0 approved/verified              | Public grounded answer/deployment                    |
| Citation validator belum fail-closed           | Any generated public response                        |
| Token tidak tersedia                           | Live provider tests; mock/evidence-only tetap lanjut |
| DB unavailable                                 | Retrieval integration; tidak boleh fake result       |
| Billing diperlukan                             | Stop dan minta persetujuan                           |
| Deployment diminta automation                  | Tunda; perlu instruksi user baru                     |

## Definition of done per implementation phase

Setiap fase wajib melaporkan:

1. file dibuat/diubah;
2. commands dan output aktual, termasuk kegagalan;
3. acceptance pass/fail;
4. risk/data/provider blockers;
5. TASKS checkbox berdasarkan test, bukan asumsi;
6. rollback path yang diuji atau alasan belum dapat diuji.
