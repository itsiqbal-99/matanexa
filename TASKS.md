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
