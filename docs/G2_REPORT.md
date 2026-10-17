# G2 — Database foundation dan integrasi kontrak

Pembaruan 17 Oktober 2026: pada kelanjutan G3, kredensial backend telah tersedia
dan koneksi TLS, migration 001–003 serta pengujian database mulai diverifikasi
secara nyata. Tabel hasil di bawah mencatat run G2 awal; hasil terbaru ada di
[G3_REPORT.md](G3_REPORT.md). Gate data nyata tetap terblokir: saat audit Neon
terdapat 0 sumber dan 0 hadits publik. Tidak ada perubahan status lisensi.

16 Oktober 2026, Asia/Jakarta. **G2 BELUM LULUS.** Fondasi kode dan tes tanpa
database tersedia; koneksi/migrasi/query Neon serta data nyata belum terbukti.
Tidak melanjutkan G3/G4, tidak deployment, tidak memasang PostgreSQL/Docker/AI
lokal. Default aplikasi tetap mock. G0/G1 dipertahankan dan diuji regresi.

## Implementasi

- Audit ulang AGENTS, START_HERE, TASKS, README, agent prompts, docs kit,
  kontrak G1, SQL desain dan kode aktual. Node portable 24.22.0 LTS/npm 11.19.1,
  arsitektur Next App Router + NestJS dan npm workspaces dipertahankan.
- pg 8.23.1 dan @types/pg 8.23.1 dipin pada lockfile. DatabaseModule global,
  lifecycle pool, TLS sertifikat diverifikasi, max pool 3, timeout terbatas,
  exception aman. Mock tidak membuat pool atau menghubungi DB.
- Modul health, hadiths, sources dan search; service/repository terpisah,
  validasi query Zod strict dan parameter UUID. GET health/sources/hadiths/:id,
  POST search, CORS lokal terbatas. DB error 503 DATABASE_UNAVAILABLE, tanpa
  fallback mock. Health hanya liveness dan keberadaan konfigurasi.
- Dua migration berversi dengan transaksi, advisory lock dan checksum history.
  Tidak ada vector/embedding. Skema final dan recovery di [DATABASE.md](DATABASE.md).
- Import JSON tervalidasi, per-record savepoint, identitas edisi/nomor teks,
  hash/idempotency, raw record dan provenance run, laporan kegagalan indeks.
  Hanya sumber approved yang diterima, record selalu draft; revisi membatalkan
  verifikasi. Pipeline tidak dapat menyetujui sumber atau mengangkat verified.
- Search lexical parameterized FTS simple + trigram + kamus editorial v1,
  ranking stabil dan pagination; seluruh read lewat published_hadiths.
  View mengecualikan draft/review/rejected, sumber non-approved dan simulasi.
- UI G1 memakai union mock/verified dan guard payload/HTTPS. Kartu/detail
  menampilkan nomor+skema, teks Arab RTL, terjemahan+atribusi, provenance dan
  grade hanya dengan penilai/URL. Copy menyertakan referensi; simpan/history
  mempertahankan payload valid. Tidak redesign UI atau memindahkan search ke web.

## Dataset dan import

[DATASET_AUDIT.md](DATASET_AUDIT.md) memuat tiga kandidat dan tautan primer:
renomureza/hadis-api-id, gadingnst/hadith-api, Sunnah.com developers. Semuanya
pending_review; MIT repository tidak dipakai sebagai bukti izin terjemahan
upstream. Tidak membuat approval palsu atau memverifikasi referensi tanpa bukti.

**Record nyata imported: 0; sumber approved: 0; hasil nyata dipublikasikan: 0.**
Import nyata tidak dijalankan, bukan run sukses dengan nol record. Laporan mesin
di [G2_IMPORT_REPORT.json](G2_IMPORT_REPORT.json) membedakan status blocked dari
hasil unit fixture. Source dump/hash nyata tidak tersedia.

Contoh transformasi query yang diuji: “Kasih hadits tentang menuntut ilmu” →
`ilmu | belajar | pengetahuan | pendidikan`. Belum ada contoh hasil lexical nyata
dengan citation yang dapat ditampilkan. Fixture API/browser bernama SIMULASI,
berisi placeholder Latin untuk bagian Arab/terjemahan, tidak berupa teks agama.
Flag verified pada double/response fixture hanya menguji cabang kontrak; tidak
menulis atau mempublikasikan fixture verified di database aplikasi.

## Perintah dan bukti

Perintah dari root memakai Node LTS lokal sesuai README. Build/test dilakukan
saat watcher berhenti untuk menghindari konflik dist. Tidak ada klaim tes
PostgreSQL berdasarkan client double. Hasil verifikasi akhir dicatat di bawah.

| Perintah                                      | Hasil                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| npm run lint                                  | Exit 0, kedua workspace                                                                         |
| npm run typecheck                             | Exit 0, API/web dan strict e2e                                                                  |
| npm test                                      | Exit 0, 10 passed, 0 failed; unit doubles dan HTTP Nest asli                                    |
| node --test apps/api/test/foundation.test.cjs | Exit 0, 2 passed, termasuk sources mock kosong/detail mock 404                                  |
| npm run build                                 | Exit 0, Nest dan Next; build akhir compiled 2.4s, TypeScript 9.6s; / dan /_not-found statis     |
| npm run test:e2e                              | Exit 0 pada kode final; 16 passed, 0 failed/flaky/skipped, 139.18 detik, desktop/mobile         |
| npm run test:smoke                            | Exit 0, 4 PASS: web/CSS, health, CORS dan mock search                                           |
| npm audit --json                              | Exit 0, 0 vulnerabilities                                                                       |
| npm run db:check                              | Exit 1, DATABASE_URL_MISSING; koneksi nyata belum diuji                                         |
| npm run db:migrate                            | Exit 1, DATABASE_URL_MISSING; migration belum diterapkan                                        |
| npm run test:db                               | Exit 0 dengan **0 passed, 1 skipped** karena TEST_DATABASE_URL kosong; bukan lulus integrasi DB |
| npm run format:check                          | Exit 0; seluruh file sesuai Prettier                                                            |

Runner final `node --test apps/api/test/*.test.cjs` terhadap build akhir juga
lulus 10/10 (3.93 detik), setelah perubahan urutan agregasi SQL. Screenshot
kontrak desktop/mobile diperiksa secara visual. Root dev dibiarkan berjalan
dan smoke akhir setelah restart lulus. Next memberi warning filesystem lambat
(benchmark 1601 ms), bukan kegagalan build/HTTP.

Tes API menutup server port acak dan pool. Cakupan tambahan G2: konfigurasi TLS
dan URL, checksum/idempotency/rollback migration melalui double, field import
wajib, duplikasi konflik, ulang import/ubah isi, sumber belum approved ditolak,
normalisasi/sinonim, SQL injection tetap parameter, empty/page offset, pemetaan
provenance, route sources/detail/lexical dan error DB tanpa payload mock/secrets.
Ranking PostgreSQL, constraints, trigger dan view pada engine nyata termasuk
suite test:db yang **belum dieksekusi** karena kredensial tidak tersedia.

Tes browser mencakup 12 regresi G1 dan 4 pemeriksaan kontrak lexical, URL/grade
invalid, DB error, RTL attributes, nomor/skema, link, clipboard dan persistence.
Semua memakai Microsoft Edge headless terisolasi. Screenshot G2 di docs/evidence/
dan JSON run lokal artifacts/g2/e2e-results.json. Screenshot kontrak bukan bukti
data sahih; placeholder Latin tidak membuktikan kualitas tipografi teks Arab nyata.
Tidak ada pengujian perangkat fisik/Safari.

## Kegagalan/keterbatasan yang tercatat

- Lint awal G2 menemukan satu non-null assertion yang tidak perlu di importer;
  assertion dihapus, lint berikutnya lulus. Strict TypeScript tidak diturunkan.
- Audit proses via Get-CimInstance dibatasi sandbox; tidak menganggapnya sebagai
  bukti proses berjalan. Startup/HTTP dan pengujian browser benar-benar dilakukan.
- Salah satu URL raw books.json upstream tidak dapat diambil tool browsing;
  jumlah record tidak ditebak. Detail ada di DATASET_AUDIT.
- db:check/db:migrate gagal karena kredensial belum tersedia; test:db skip.
  Tidak membuat database lokal atau token palsu sebagai pengganti.
- Peringatan NO_COLOR/FORCE_COLOR dari runner browser tidak mengganggu tes.
- FTS simple tidak men-stem bahasa Indonesia; OR sinonim dapat menurunkan
  precision. Arab belum diindeks. Benchmark relevansi/recall/MRR belum tersedia.
  Total kandidat dihitung tepat dalam query bertimeout, bukan klaim cakupan semua
  hadits; UI dibatasi page 1–10/limit 20. Tidak ada semantic search pada G2.
- File environment lokal diabaikan Git (`git check-ignore` diverifikasi).
  Tidak ada credentials yang ditambahkan ke source/lockfile. Repository sejak
  G0 masih untracked, tidak membuat commit otomatis.

## Gate dan blocker

| Kriteria                                                                 | Status                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Modul/DTO/API dan kontrak UI, mock tetap berfungsi                       | Lulus pada HTTP dan fixture contract tests                 |
| Schema/migration runner/import/repository                                | Kode + unit doubles lulus; PostgreSQL runtime belum diuji  |
| Nest mengakses Neon, migration berhasil, draft tidak bocor pada DB nyata | Belum diuji; DATABASE_URL/TEST_DATABASE_URL belum tersedia |
| Audit sumber dan penghentian import tanpa bukti                          | Selesai; semua kandidat pending_review                     |
| Import nyata berprovenance, hadith detail/lexical/UI dari Neon           | Terblokir izin/verifikasi dan koneksi DB                   |
| G2 selesai                                                               | **Belum**                                                  |

Untuk melanjutkan pengujian, simpan DATABASE_URL branch development dan
TEST_DATABASE_URL branch test Neon di apps/api/.env; jangan kirim secret ke chat.
Kemudian jalankan langkah DATABASE.md. Untuk data nyata dibutuhkan izin konten,
versi dataset dan verifikasi tiap record oleh pemeriksa, sebelum publikasi.
Tidak menghapus checkbox blocker sampai bukti eksekusi tersedia.

## File dibuat/diubah pada G2

```text
package.json, package-lock.json, README.md, TASKS.md, playwright.config.ts
apps/api/package.json, apps/api/.env.example, apps/api/README.md
apps/api/src/app.module.ts, common/api-exception.filter.ts, config/environment.ts
apps/api/src/database/{connection,database.module,database.service,migrations,importer,cli}.ts
apps/api/src/modules/health/{health.module,health.service}.ts
apps/api/src/modules/search/{search.module,search.service,lexical-query}.ts
apps/api/src/modules/hadiths/{hadith.module,hadith.controller,hadith.service,hadith.repository}.ts
apps/api/src/modules/sources/{sources.module,sources.controller}.ts
apps/api/test/{database.test,database.integration,fixtures,foundation.test}.cjs
apps/web/README.md, apps/web/lib/api-client.ts
apps/web/features/search/{types,storage,use-workspace,composer,result-card,search-results,search-workspace}.ts(x)
contracts/openapi.yaml
db/migrations/{001_foundation,002_search_indexes}.sql
tests/e2e/{chat,database-contract}.spec.ts
docs/{DATABASE,DATASET_AUDIT,G2_REPORT}.md, docs/G2_IMPORT_REPORT.json
docs/evidence/g2-*.png
decisions/ADR-004.md
```

SQL desain kit, evidence G0/G1 dan dokumen fase sebelumnya tetap tersedia.
Artefak runner/cache/dependency/environment tetap diabaikan Git.
