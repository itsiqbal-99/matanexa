# ONE-SHOT PROMPT — Build Matanexa from Zero (Local First)

Anda adalah principal software engineer, senior Next.js/NestJS architect, search/retrieval engineer, QA engineer, dan product designer. Bangun proyek bernama sementara **Matanexa**, mesin pencari hadits dalam bahasa Indonesia sehari-hari dengan UI chat modern **yang benar-benar dapat dijalankan secara lokal**.

## Instruksi pertama (WAJIB)
1. Baca **semua** file di paket ini secara menyeluruh, khususnya `AGENTS.md`, `START_HERE.md`, `TASKS.md`, semua `docs/*`, `db/*`, `contracts/openapi.yaml`, `decisions/*`, `assets/chat-ui-reference.png`. Jangan coding sebelum memahami scope dan data policy.
2. Jadikan dokumen tersebut source of truth. Jika detail ambigu, pilih solusi paling sederhana yang konsisten dengan zero-cost, local-first, strict data quality; catat asumsi dalam ADR. **Jangan mengubah arsitektur** menjadi frontend-only, Next API routes, Supabase Edge Functions, LLM local, atau Spring Boot.
3. Buat repo bernama `matanexa` dalam direktori kerja yang diizinkan dan copy spesifikasi kit beserta gambar referensi ke repo. Pertahankan checklist TASKS.md dan perbarui sesuai hasil nyata.

## Target arsitektur yang tidak boleh ditawar
- **Next.js App Router + TypeScript strict** di `apps/web` pada `localhost:3000` — UI saja, Tailwind CSS, shadcn/ui bila efisien, Motion minimal, accessibility, mobile responsive.
- **NestJS + TypeScript strict** di `apps/api` pada `localhost:4000` — semua API, data validation, PostgreSQL, lexical/semantic search, ranking dan Cloudflare API. Struktur modular Controller/Service/Repository/Provider dengan dependency injection.
- **npm workspaces** di root, satu perintah `npm run dev` menjalankan dua aplikasi, scripts `lint`,`typecheck`,`test`,`build` yang benar-benar ada. `.env.example` untuk masing-masing app dan `.gitignore` aman.
- **PostgreSQL + pgvector** sebagai basis data; gunakan remote Neon Free dalam lexical/hybrid, dan **tidak** menginstal PostgreSQL/Docker lokal. Untuk SQL Node gunakan `pg` parameterized, migrasi dan import via script Node.
- **Cloudflare Workers AI REST `@cf/baai/bge-m3`** dipanggil server NestJS hanya untuk embeddings, **bukan generative LLM**. Simpan vektor 1024 dan hash idempotent. Kunci cloud disimpan hanya di backend.
- Tiga mode `mock | lexical | hybrid`; fallback lexical saat AI gagal; database error tidak boleh diganti hasil palsu.
- **DILARANG deployment** pada pengerjaan ini. Jangan memilih host, setup domain, men-deploy atau menagihkan biaya.

## Kualitas UI
Ikuti UX pada `docs/02_UX_UI.md` dan gambar acuan sebagai moodboard: tampilan simpel seperti aplikasi chat agent modern. Sidebar slim/collapsible, initial welcome + prompt suggestions, bubble pertanyaan, daftar hasil hadits dengan source badge, detail sheet, Arabic RTL, toggle Arab/terjemahan, filter sumber, bookmark/history dalam localStorage, dark/light mode. UI harus elegan, clean, profesional, responsif, microinteraction halus, **bukan dashboard** atau UI AI-slop. Jangan tampilkan login/profile palsu, notificaton palsu, atau fitur yang belum tersedia. Semua tombol harus bekerja.

## Data religious accuracy gate
Jangan gunakan LLM untuk menciptakan atau menyusun ulang matan hadits, terjemahan, penomoran, status shahih atau derajat. Jangan masukkan "hadits contoh" seolah asli. Mode mock **wajib jelas diberi label placeholder bukan hadits**. Hanya data dengan `verification_status='verified'` dan `permission_status='approved'` boleh keluar dari search API. Dataset GitHub hanya kandidat, lisensi repo tidak membuktikan hak reproduksi terjemahan dari upstream. Sediakan import staging + verifikasi sebelum publish. Jika data berlisensi/verified tidak tersedia, jangan menyatakan fase hasil real sudah lengkap; laporkan blocker spesifik dan lanjutkan pekerjaan mock/test yang dapat dilakukan.

## Build step-by-step & gates
Lakukan berurutan: G0 monorepo/start dua server/health -> G1 UI mock end-to-end -> G2 database schema + Nest API -> G3 lexical + approved corpus -> G4 Cloudflare embeddings hybrid dan fallback -> G5 tests + local handoff. Setelah setiap gate, jalankan test relevan, koreksi kegagalan, dan update `TASKS.md`. Hindari membuat semua sekaligus tanpa verifikasi. Jika tool/credential tidak tersedia, gunakan test doubles untuk milestone yang memungkinkan; jangan mengarang hasil eksekusi atau fake verified corpus.

## Search specification
Input bahasa Indonesia bebas, DTO validated 3–300 karakter; lexical menggunakan FTS PostgreSQL `simple` + pg_trgm, curated synonyms, SQL parameterized. Hybrid mengambil keyword + vector candidates dari verified+approved, merge RRF, jangan tampilkan confidence % palsu. One user chat bubble = independent query (MVP bukan agent LLM multi-turn). Output JSON konsisten kontrak `contracts/openapi.yaml`; backend terpisah, frontend via `NEXT_PUBLIC_API_BASE_URL` only. Jaga loading/cancel/empty/errors/fallback dan pagination.

## Testing & entrega akhir
Setiap milestone laporkan: files changed, perintah nyata dan hasil, screenshot UI desktop dan mobile jika tooling memungkinkan, risiko, sisa tugas. Minimal unit/integration/API/UI tests + typecheck/lint/build. G5 harus menghasilkan `LOCAL_HANDOFF.md` dengan langkah jalankan di Windows, seluruh localhost URLs, mode, sample query tests, benchmark yang jujur, dan daftar isu.

**Mulai sekarang dari membaca dokumen, audit environment, lalu G0. Kerjakan sebanyak mungkin fase yang bisa dibuktikan pada lingkungan ini tanpa menunggu deployment. Jangan meminta pertanyaan ulang yang jawabannya sudah ada di kit.**
