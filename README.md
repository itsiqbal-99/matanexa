# Matanexa — Pengembangan lokal

Implementasi mencakup G0, G1, fondasi database G2, dan mesin lexical G3.
G2/G3 tetap parsial sampai tersedia corpus berizin/terverifikasi. Pengujian
Neon dan evaluasi fixture dijelaskan di [docs/G3_REPORT.md](docs/G3_REPORT.md).
Mode bawaan tetap mock, tanpa kutipan hadits nyata. Spesifikasi tetap
berada di [START_HERE.md](START_HERE.md) dan `docs/`. Status verifikasi G1 ada di
[docs/G1_REPORT.md](docs/G1_REPORT.md). Setup database: [docs/DATABASE.md](docs/DATABASE.md).
Audit sumber: [docs/DATASET_AUDIT.md](docs/DATASET_AUDIT.md).
Persiapan data G2.5: [docs/G25_REPORT.md](docs/G25_REPORT.md).
Pilot nyata G2.6: [docs/G26_REPORT.md](docs/G26_REPORT.md). Kelanjutan hybrid
Cloudflare: [docs/G26_HYBRID_REPORT.md](docs/G26_HYBRID_REPORT.md). Tidak ada deployment.
Redesign UI navy/cobalt, motion pencarian dan hasil validasinya:
[docs/UI_REDESIGN_REPORT.md](docs/UI_REDESIGN_REPORT.md). Hardening G4 tetap belum
dinyatakan selesai oleh pekerjaan UI ini.

## Kebutuhan dan menjalankan

- Windows x64; Node **24.22.0 LTS** dan npm **11.x**. `.nvmrc`, `.node-version`, dan
  `engines` mengunci lini runtime yang diuji. Gunakan `nvm install 24.22.0` dan
  `nvm use 24.22.0` jika memakai NVM Windows.
- Internet diperlukan saat menginstal dependency; sesudahnya mock berjalan lokal.
- Jalankan semua perintah berikut dari root proyek:

```powershell
npm ci
Copy-Item apps\web\.env.local.example apps\web\.env.local
Copy-Item apps\api\.env.example apps\api\.env
npm run dev
```

Web: <http://localhost:3000>. API:
<http://localhost:4000/api/v1/health>. `Ctrl+C` menghentikan keduanya. Kedua
aplikasi bind ke `127.0.0.1` untuk akses lokal. Port yang terpakai menyebabkan
startup gagal; root menghentikan aplikasi pasangannya.

Audit G0 memakai arsip Node resmi di `.tools/` yang diabaikan Git, tanpa mengganti
Node global. Jika folder tersebut tersedia, aktifkan untuk sesi PowerShell ini:

```powershell
$env:Path = "$PWD\.tools\node-v24.22.0-win-x64;$env:Path"
```

Folder `.tools/` tidak menjadi dependency aplikasi dan tidak ikut repository.
Pengguna lain cukup memasang versi LTS di atas.

## Verifikasi

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

Untuk tes browser, jalankan kedua server hingga Next siap dan Nest memetakan
route search. Pada terminal lain dengan Node LTS yang sama:

```powershell
npm run test:smoke
npm run test:e2e
```

Suite browser memakai Microsoft Edge yang sudah terpasang, dalam profil headless
terisolasi, dengan viewport desktop/mobile. Konfigurasi ada di `playwright.config.ts`.
Screenshot/report/trace regresi UI terbaru ada di `artifacts/ui-redesign/`
(diabaikan Git); bukti historis tetap di `docs/evidence/`. Kompilasi pertama dapat lambat pada filesystem
ini; tunggu halaman siap sebelum smoke test.

Lint/typecheck/build berjalan untuk kedua workspace. `npm test` menjalankan tes
fondasi HTTP NestJS, normalisasi, validasi dan mock search, tanpa DB/token.
Jangan menjalankan build bersamaan dengan watcher yang memakai output aplikasi
yang sama. Build web tidak mengunduh font atau aset eksternal.

## Batas tanggung jawab

`apps/web` hanya Next.js App Router dan UI; `apps/api` memiliki REST NestJS.
Search memakai controller → service → repository. Mode `mock` tidak mengakses DB;
`lexical` memakai Neon melalui `pg`, membutuhkan DATABASE_URL dan migrasi.
`hybrid` tersedia dengan fallback lexical; indeks kosong tidak memanggil AI.
`databaseConfigured` hanya menunjukkan konfigurasi,
bukan hasil tes koneksi. `npm run db:check` menguji koneksi nyata.
Jangan menaruh token di `NEXT_PUBLIC_*`. File environment lokal diabaikan Git.

Konfigurasi port API ada di `apps/api/.env`; sesuaikan URL publik web jika port
API berubah. Jika mengubah port web, sesuaikan script web dan `CORS_ORIGINS`.
Origin hanya mengizinkan HTTP `localhost` atau `127.0.0.1` dengan port eksplisit;
bawaan hanya port 3000. CORS membatasi pembacaan browser, bukan autentikasi.

Laporan hasil eksekusi dan daftar file: [docs/G0_REPORT.md](docs/G0_REPORT.md).
Keputusan G1: [ADR-003](decisions/ADR-003.md). Laporan awal G2 ada di
[docs/G2_REPORT.md](docs/G2_REPORT.md). Pipeline, kamus, ranking dan batas metrik
G3 dijelaskan di [docs/SEARCH_ENGINE.md](docs/SEARCH_ENGINE.md). Status gate ada
di [TASKS.md](TASKS.md).

## Pilot hadits nyata G2.6

Jangan menimpa `.env` yang telah berisi kredensial. Untuk demo yang sudah diimpor,
atur hanya tiga nilai ini di `apps/api/.env`, lalu restart root dev:

```dotenv
NODE_ENV=development
APP_DATA_SCOPE=local_pilot
APP_SEARCH_MODE=lexical
```

`npm run dev` menjalankan web 3000 dan API 4000. Masing-masing dapat dijalankan
di terminal terpisah dengan `npm run dev --workspace @matanexa/web` dan
`npm run dev --workspace @matanexa/api`.

Pilot 404 hadits menggunakan sumber `research_only`; izin publikasi dan
tinjauan manusia belum selesai. Label UI bukan klaim verified. Tidak ada
grade yang diimpor. Mode publik tetap hanya approved + verified. Kembali ke
`APP_DATA_SCOPE=published` untuk menguji isolasi (corpus publik saat ini kosong).
Corpus di `data/` serta screenshot/teks evaluasi di `artifacts/` tidak ikut Git
dan tidak boleh didistribusikan.

Untuk mereproduksi dari sumber yang dipatok revisinya, dengan Node 24.22.0:

```powershell
$env:NODE_ENV='development'
npm run build --workspace @matanexa/api
npm run db:migrate
npm run pilot:download
npm run pilot:prepare
npm run pilot:import -- --dry-run
npm run pilot:import
npm run pilot:reindex
npm run pilot:evaluate
```

`pilot:evaluate` memakai HTTP NestJS dan DB nyata, membandingkan lexical dengan
permintaan hybrid. Selama index kosong hasil kedua adalah lexical_fallback,
bukan bukti hybrid semantik. `-- --lexical-only` membatasi evaluasi lexical.
`pilot:reindex` hanya memperbarui salinan indeks, bukan teks sumber. Impor ulang
identik melewati record yang sama. Jalankan `npm run test:pilot` setelah web/API
pilot hidup untuk tes desktop/mobile. Build/test API dilakukan saat watcher mati.

Untuk mengulang evaluasi G3 setelah build backend dan setup database:

```powershell
npm run test:db
npm run search:evaluate
```

Evaluasi memerlukan TEST_DATABASE_URL, memakai tabel TEMP berlabel SIMULASI,
dan menghasilkan baseline serta 64 query/judgment di `docs/G3_*.json`.
Metrik fixture bukan kualitas hadits nyata. Corpus aplikasi tidak diisi oleh
command evaluasi. Mode mock tetap tidak membutuhkan koneksi DB.

## Menjalankan aplikasi secara terpisah

Jalankan dari root pada dua terminal (Node LTS yang sama):

```powershell
# Terminal 1 — Next.js, localhost:3000
npm run dev --workspace @matanexa/web
# Terminal 2 — NestJS, localhost:4000
npm run dev --workspace @matanexa/api
```

Untuk keduanya sekaligus tetap `npm run dev`. Hentikan watcher sebelum build/test
yang menulis folder dist. Perintah migration/import dan recovery dijelaskan di
[docs/DATABASE.md](docs/DATABASE.md); jangan menjalankan SQL desain kit langsung.

## Hybrid Cloudflare untuk corpus pilot

Kredensial tetap hanya di apps/api/.env. Konfigurasi demo saat ini:

```dotenv
NODE_ENV=development
APP_DATA_SCOPE=local_pilot
APP_SEARCH_MODE=hybrid
```

`CLOUDFLARE_ACCOUNT_ID` dan `CLOUDFLARE_API_TOKEN` diperlukan. Tidak ada token
frontend. Model tunggal @cf/baai/bge-m3, 1024 dimensi. Hentikan watcher dahulu:

```powershell
npm run build --workspace @matanexa/api
npm run pilot:index
npm run pilot:index
npm run pilot:evaluate -- --hybrid-benchmark
npm run test:db
npm run dev
```

Index ulang identik melewati record tanpa request API. Batch maksimal 4 teks,
100ms antarbatch, satu retry hanya untuk timeout/5xx; 401/403/429 menghentikan
run dan dapat dilanjutkan. Artefak aman ada di artifacts/g26-hybrid; corpus,
vector dan teks hasil tidak didistribusikan. Embedding memakai terjemahan
Indonesia asli yang sudah diimpor, tanpa generasi teks atau inferensi grade.
Public scope tetap memakai filter approved+verified, termasuk pada jalur vector.
Mode hybrid gagal provider → lexical_fallback; DB gagal → 503.

Tes browser mode hybrid setelah root dev siap:

```powershell
$env:PILOT_EXPECT_MODE='hybrid'
npm run test:pilot
```

Benchmark 30 pertanyaan membedakan 10 query kalibrasi lama dan 20 parafrasa baru
yang dibekukan sebelum hasil hybrid diamati. Judgment relevansi terbatas,
bukan review ilmiah/manusia independen dan bukan bukti recall seluruh kitab.
