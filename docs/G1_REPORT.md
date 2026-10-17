# G1 — Chat UI dan mock search

Tanggal: 16 Oktober 2026 (Asia/Jakarta). Scope hanya G1.
**Status: G1 LULUS.** Seluruh acceptance G1, lint, typecheck, unit/integration,
build, format, audit dan smoke akhir lulus. Tidak ada blocker implementasi G1.
Kedua server dibiarkan berjalan melalui root `npm run dev`:
`http://localhost:3000` dan `http://localhost:4000/api/v1/health`.
G2 dan seterusnya belum dikerjakan. Impor canvas eksternal yang ditolak tidak
menjadi syarat untuk menjalankan atau menguji aplikasi lokal.

## Implementasi

- Next App Router: sidebar collapsible/drawer mobile, welcome dengan lima
  pertanyaan klik, textarea auto-resize, Enter/Shift+Enter, validasi 3–300
  codepoint, hasil berlabel simulasi, filter koleksi, detail, salin dan simpan.
- React state dan localStorage: 20 entri query mandiri, 100 simpanan, tema
  terang/gelap dan preferensi bagian Arab. Refresh mempertahankan riwayat;
  pengguna memilih entri untuk membuka kembali hasil. Hapus data meminta
  konfirmasi dan mencakup riwayat serta simpanan. Data rusak/quota storage
  ditangani tanpa memblokir pencarian.
- Composer berada di luar area scroll hasil sehingga tidak menutupi kartu.
  Native dialog memakai focus trap Tab/Shift+Tab, Escape dan restore focus.
  Responsive pada 1440×960, 390×844 dan pemeriksaan overflow 360×740.
- Nest controller → service → mock repository. Zod DTO strict, normalisasi
  NFKC, lowercase, whitespace/control characters. Matching kata utuh dan
  sinonim deterministik untuk ilmu, orang tua, marah, makan, lisan dan sedekah.
  Dua contoh per topik = 12 fixture. Tidak ada hadits nyata atau dataset agama.
- API client frontend terpusat. Timeout 10 detik, AbortController, disabled
  pending input, tombol batal, retry, empty/error/invalid-response state, dan
  penolakan respons terlambat dari query yang sudah diganti.
- Respons mengikuti envelope data/meta kit, bukan menduplikasi hasil ke
  format lain. `data.query` dan field mock nullable ditambahkan pada kontrak.
  Detail mock memakai payload search; endpoint hadith/sources nyata tetap G2.

## Keamanan dan provenance

Semua hasil selalu `isVerified: false`; `hadithNumber`, `arabicText`, `translation`,
`grade`, `sourceUrl` dan `referenceUrl` null. `citation.number = MOCK` merupakan
penanda fixture, bukan nomor hadits, dan tidak ditampilkan sebagai nomor hadits.
Koleksi A/B jelas berlabel simulasi, bukan kitab nyata. Copy menyertakan label
besar “DATA SIMULASI — BUKAN HADITS TERVERIFIKASI”. Tidak ada URL sumber palsu.

Teks Arab/terjemahan/derajat memang belum tersedia, sehingga detail menampilkan
pesan ketersediaan, bukan teks agama buatan. CSS RTL/font Arab disiapkan untuk
fase data nyata; tampilan konten Arab nyata belum dapat diuji pada G1.

Matching hanya di NestJS. Next tidak mengakses DB/AI, tidak mempunyai API route
atau Server Action bisnis. CORS localhost tetap terbatas, sekarang menerima
POST. Error aman dengan request ID dan tanpa stacktrace/body query di log.
Tidak ada model lokal, Docker, PostgreSQL, Neon, Cloudflare, auth atau deployment.

## Perintah dan bukti

Runtime: Node 24.22.0 LTS portable dari `.tools/`, npm 11.19.1. Node global tidak
diganti. Perintah root memakai PATH sesi ke runtime LTS seperti README.

| Perintah                   | Hasil                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| `npm run lint`             | Exit 0; kedua workspace, tanpa error/warning lint                  |
| `npm run typecheck`        | Exit 0; API, web dan strict e2e pada kode akhir                    |
| `npm test`                 | Exit 0; 5 passed, 0 failed, 94.38 detik pada kode akhir            |
| `npm run build`            | Exit 0; Nest sukses, Next compiled 2.5 menit, TypeScript 5.6 detik |
| `npm run test:smoke`       | Exit 0; 4 PASS, termasuk sesudah restart terakhir                  |
| `npm run test:e2e` (akhir) | **12 passed**, 0 failed/skipped/flaky, exit 0, 82.39 detik         |
| `npm run format:check`     | Exit 0; seluruh file sesuai Prettier                               |
| `npm audit --json`         | Exit 0; 0 vulnerabilities pada lockfile akhir                      |
| Instalasi dependency akhir | 489 paket diaudit saat instalasi; 0 vulnerabilities                |

Tes browser memakai Microsoft Edge headless dengan profil terisolasi, bukan
profil browser pengguna. Alur positif mengakses NestJS asli melalui CORS.
Intercept hanya untuk menguji network failure, loading tertahan, response
invalid dan timeout. Semua skenario memeriksa tidak ada uncaught page error.

Enam skenario dijalankan pada desktop dan mobile:

1. Welcome, sidebar/drawer, tema, preferensi Arab setelah refresh, screenshot.
2. HTTP search nyata, filter, detail, focus trap/restore, clipboard, bookmark,
   percakapan baru, history refresh, saved view dan hapus data.
3. Input pendek/panjang, Enter/Shift+Enter, query mandiri, empty dan overflow.
4. Loading/disabled input, batal, query pengganti dan reduced motion.
5. Backend unavailable, retry, respons invalid/claim non-mock ditolak, timeout.
6. JSON localStorage rusak dan quota penyimpanan tanpa mematikan pencarian.

Unit/integration API memeriksa enam topik, sinonim, whole-word negative,
normalisasi idempotent, batas Unicode 300/301, query injeksi, filter/pagination,
body/JSON invalid, unknown fields, sourceSlugs duplikat, CORS preflight dan safe
error. Server tes memakai port acak dan ditutup saat selesai.

## Kegagalan yang ditemukan dan diperbaiki

- Instalasi `@playwright/test` terbaru sempat gagal ETARGET karena metadata
  playwright 1.64.1 tidak konsisten. Versi 1.64.0 diverifikasi lalu dipin; install
  sukses. Edge yang sudah tersedia dipakai tanpa download browser baru.
- Smoke pertama timeout 60 detik saat cold compile. Percobaan berikutnya
  menemukan assertion CSS warisan G0 yang mengandalkan komentar `tailwindcss`
  atau variabel `--tw-`. Diganti pemeriksaan preflight dan stylesheet terkompilasi;
  empat pemeriksaan HTTP berikutnya lulus.
- Browser run pertama: 4 passed, 8 failed. React Strict Mode menyebabkan event
  close cleanup menutup dialog yang dibuka kembali; ditangani guard open state.
  Selector alert tes juga mengenai announcer Next; diarahkan ke composer-error.
- Saat run pertama, output dist API hilang dan child gagal memuat app.module,
  membuat beberapa tes mobile gagal koneksi. API dibangun ulang dengan cache
  incremental disk dinonaktifkan dan pengecualian directory watch. Reload API
  disengaja, health dan search sesudah reload lulus; suite akhir tetap stabil.
  Jangan menjalankan build/test yang mengubah dist bersamaan dengan watcher.
- Run kedua: 10 passed, 2 failed pada putaran fokus native dialog. Ditambah
  pengelolaan Tab/Shift+Tab yang eksplisit.
- Run ketiga: 10 passed, 2 failed karena selector history ambigu dengan saran
  pertanyaan bernama sama. Selector dibatasi ke navigasi riwayat. Alur salin,
  simpan dan focus trap sudah lewat pada run itu.
- Run keempat: seluruh 12 tes lulus. Lebar detail mobile 390px juga diperiksa.
- Impor HTML rancangan ke Superdesign **ditolak automatic approval review**:
  ekspor konten proyek lokal ke layanan eksternal belum diizinkan. Tidak mencoba
  jalur upload lain. Canvas yang sempat dibuat tetap kosong; desain, implementasi
  dan screenshot aplikasi dibuat lokal, tanpa generasi/kredit berbayar.

## File dibuat/diubah

```text
package.json, package-lock.json, .gitignore, README.md, TASKS.md
playwright.config.ts, tsconfig.e2e.json
apps/web/
  package.json, README.md, next.config.ts
  app/page.tsx, app/layout.tsx, app/globals.css
  components/modal.tsx
  features/search/
    types.ts, storage.ts, use-workspace.ts
    search-workspace.tsx, search-results.tsx
    composer.tsx, sidebar.tsx, result-card.tsx
  lib/api-client.ts
apps/api/
  package.json, README.md, tsconfig.json
  src/app.module.ts, src/create-app.ts
  src/common/api-exception.filter.ts
  src/modules/health/health.service.ts
  src/modules/search/
    search.schema.ts, search-validation.pipe.ts
    search.controller.ts, search.service.ts, mock.repository.ts
  test/search.test.cjs
contracts/openapi.yaml, contracts/search-response-MOCK.example.json
scripts/smoke.mjs
tests/e2e/chat.spec.ts
decisions/ADR-003.md
docs/G1_REPORT.md
docs/evidence/g1-*.png (9 screenshot)
.superdesign/design-system.md, .superdesign/init/*.md (konteks desain lokal)
```

Artefak report JSON ada di `artifacts/g1/e2e-results.json` (diabaikan Git).
Sembilan screenshot lokal: desktop/mobile welcome, dark, results, detail serta
mobile 360px. Screenshot dibaca secara visual setelah dibuat; bukan hanya
mengandalkan source HTML. File `.superdesign/tmp/g1-chat.html` lokal diabaikan Git.
File `.env`, dokumen kit lain, CSV benchmark dan perubahan `.vscode/` pengguna
tidak diubah oleh pekerjaan G1 ini.

## Batas dan risiko

- Mock adalah simulasi keyword, bukan semantic search atau hadits terverifikasi.
  Dataset approved/verified dan evaluasi retrieval nyata belum tersedia; CSV
  evaluasi tidak diisi jawaban buatan. G2 dan seterusnya tidak dikerjakan.
- Browser QA memakai emulasi viewport mobile di Edge; perangkat fisik, Safari
  dan keyboard virtual perangkat nyata belum diuji.
- Filesystem lokal memberi warning slow filesystem, paling tinggi 2073 ms pada
  pengujian ini. Cold build/dev dapat lambat; warm HTTP dan interaksi diuji.
- Peringatan deprecation ESLint 9 dari G0 tetap berlaku untuk kompatibilitas
  plugin. Runner juga memberi warning NO_COLOR/FORCE_COLOR yang tidak mengubah
  hasil tes. Tidak ada auto-upgrade layanan atau biaya baru.
