# Matanexa — Local-First Development Kit (v2.0)

**Status:** aplikasi lokal Next.js/NestJS sudah berjalan; vNext dimigrasikan
bertahap tanpa big-bang rewrite. Blueprint dan ADR-007–009 disetujui pada 21
Oktober 2026; Phase 1 membangun governance kontrak/safety dan Phase 2 membangun
provider abstraction yang tetap nonaktif untuk LLM business flow. Nama
**Matanexa masih working title**, belum klaim bebas merek/domain.

## Tujuan yang dikunci

Website pencarian hadits dengan input bahasa Indonesia sehari-hari, UX seperti chat agent modern, hasil berupa **kutipan database hadits yang dapat diverifikasi**, bukan generasi LLM. Target pertama **localhost**, bukan deployment.

Kontrak `/api/v1` tetap mesin pencari non-generatif. Target vNext menambah API v2
multi-turn dan grounded generation secara bertahap; fitur itu belum aktif setelah
Phase 2 dan hanya boleh memakai evidence approved+verified dengan validator
fail-closed. Lihat `docs/MIGRATION_PLAN.md`.

- **Frontend:** Next.js App Router + TypeScript, Tailwind, shadcn/ui. Port **3000**.
- **Backend terpisah:** NestJS REST API + TypeScript, port **4000**. Frontend tidak mengakses database/API AI langsung.
- **Data:** Neon PostgreSQL + pgvector pada free tier. Database tetap remote agar tidak perlu install PostgreSQL/Docker di laptop. Internet diperlukan pada mode `lexical`/`hybrid`.
- **AI:** Cloudflare Workers AI `@cf/baai/bge-m3` melalui **REST API yang dipanggil NestJS**. Tidak menjalankan LLM atau embedding model lokal.
- **Tiga mode:** `mock` (tanpa akun Internet/API/DB; hasil placeholder jelas); `lexical` (Neon, tanpa AI); `hybrid` (Neon + Cloudflare embedding).
- **Tidak membuat fitur deployment** sampai semua acceptance criteria lokal terpenuhi.
- **Biaya target Rp0** selama tidak melampaui kuota free tier; bukan jaminan tanpa batas.

## Cara memakai dengan AI coding agent

1. Ekstrak ZIP di folder kerja Windows, misalnya `C:\projects\matanexa-kit`.
2. Buka folder kit ini dengan AI agent di editor (atau gabungkan isinya ke folder repository baru).
3. Kirim isi **`agent/ONE_SHOT_PROMPT.md`** sebagai instruksi awal. Agent wajib membaca `AGENTS.md`, `docs/*`, `db/*`, dan `TASKS.md` **sebelum coding**.
4. Agent membuat repository baru `matanexa` **di dalam workspace yang disetujui** dengan `apps/web` dan `apps/api`. Salin dokumen kit ke repo itu agar tetap menjadi source of truth.
5. Jangan memberikan cloud credentials sebelum **G0–G2** sudah lulus. Mulai dari mode `mock` sepenuhnya.
6. Untuk integrasi nyata, buat akun Neon dan Cloudflare free jika belum ada. Kredensial hanya di `.env` backend lokal yang di-gitignore.
7. Agent harus menunjukkan bukti test/build secara nyata; tidak boleh melaporkan lulus tanpa eksekusi.

## Daftar isi

- `AGENTS.md` — instruksi kontrak lintas-agent.
- `agent/ONE_SHOT_PROMPT.md` — prompt utuh untuk build dari nol.
- `agent/PHASE_PROMPTS.md` — prompt pendek saat memecah kerja besar.
- `TASKS.md` — checkpoint berurutan dan artefak bukti.
- `docs/01_PRODUCT_SCOPE.md` — MVP, non-MVP, persona, user journeys.
- `docs/02_UX_UI.md` — chat-like UI, interaction, loading/empty/errors.
- `docs/03_ARCHITECTURE.md` — pemisahan tanggung jawab dan diagram.
- `docs/04_DATA_GOVERNANCE.md` — izin, provenance, grading, verifikasi.
- `docs/05_SEARCH_SPEC.md` — lexical, embedding, hybrid, fallback.
- `docs/06_API.md` & `contracts/openapi.yaml` — kontrak backend.
- `docs/07_LOCAL_SETUP.md` — Windows, perintah, .env, troubleshooting.
- `docs/08_TEST_AND_ACCEPTANCE.md` — penilaian yang dapat diuji.
- `docs/09_COST_SECURITY.md` — bebas GPU, kuota dan keamanan.
- `docs/10_POST_MVP.md` — deployment sengaja di luar scope.
- `docs/ARCHITECTURE_VNEXT.md` dan `docs/MIGRATION_PLAN.md` — target serta urutan migrasi.
- `docs/PRIVACY_RETENTION_POLICY.md` — batas data percakapan/provider.
- `db/001_schema.sql`, `db/002_search_examples.sql` — SQL desain dan contoh aman.
- `tests/search-evaluation.csv` — 30 query benchmark (expected IDs kosong sampai kurasi).
- `templates/*` — konfigurasi dan contoh kontrak, tanpa secrets.
- `assets/chat-ui-reference.png` — referensi visual, **bukan data hadits sahih**.

## Definition of Done lokal

- Satu perintah `npm run dev` (di root) menjalankan web dan API.
- `http://localhost:3000` punya UI chat responsif seperti referensi dan tidak penuh dashboard.
- `http://localhost:4000/api/v1/health` memberi respons healthy.
- Mock end-to-end dan error states lulus **tanpa kunci API atau DB**.
- Lexical end-to-end lulus pada **dataset yang izin dan referensinya disetujui**.
- Hybrid menambah pencarian semantik, tidak mengarang hadits dan fallback ke lexical bila AI tidak tersedia.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` lulus.
- Tidak ada secret, keterangan hadits rekaan, data berlisensi tidak jelas, atau sistem pembayaran.

**Sumber teknis:** https://docs.nestjs.com/first-steps ; https://nextjs.org/docs/app/getting-started/installation ; https://developers.cloudflare.com/workers-ai/models/bge-m3/ ; https://neon.com/docs/extensions/pgvector
