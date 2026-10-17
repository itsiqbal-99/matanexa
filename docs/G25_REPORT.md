# G2.5 — Audit dataset dan persiapan evaluasi

17 Oktober 2026, Asia/Jakarta. **G2.5 memakai jalur fixture simulasi yang
diizinkan instruksi tahap ini. Pilot 100–300 hadits nyata tetap blocked.**
Kesiapan data nyata G4 belum terpenuhi; tidak mengerjakan G4 atau deployment.

## Hasil audit

Audit langsung melalui `npm run db:audit`: sumber 0, approved 0, hadits nyata 0,
simulasi persisten 0, hasil publik 0. Migrasi 001_foundation, 002_search_indexes
dan 003_curated_topics tercatat terpasang. Struktur kolom tersimpan di
[G25_DATABASE_AUDIT.json](G25_DATABASE_AUDIT.json). Tidak mengulang migrasi pada
schema aplikasi atau menambah schema untuk G2.5. Migrasi di schema test acak
hanya dijalankan oleh suite integrasi untuk menguji runner/idempotency.

Empat kandidat—gadingnst/hadith-api, renomureza/hadis-api-id,
hapibi/hadith-json dan Sunnah.com developers—ditinjau dari sumber primer.
Seluruhnya pending_review untuk penggunaan konten proyek. Bukti software MIT
tidak dipakai sebagai persetujuan redistribusi terjemahan upstream. Rincian
metadata, penomoran, asal dan ketidakpastian: [DATASET_AUDIT.md](DATASET_AUDIT.md).
Tidak ada status sumber yang diubah menjadi approved.

Tidak memilih corpus nyata karena izin Arab/Indonesia dan pasangan
edisi/penomoran belum terbukti. Tidak mengunduh 100–300 record agar terlihat
memenuhi angka target. Cross-check nyata belum dilakukan: sampel 0;
mismatch, missing fields dan nomor inkonsisten **N/A**, bukan nol masalah.
Legalitas, integritas data dan verifikasi ilmiah dipisahkan dalam audit.

## Dataset pengujian yang dipilih

`tests/fixtures/g3-search.json` berisi 64 pertanyaan asli Indonesia: formal,
informal, typo, sinonim, panjang/pendek, ambigu, negasi dan tanpa hasil.
Generator membentuk 30 label topik, dua pengecoh dan satu duplikat buatan:
33 row TEMP, 32 dokumen kanonik. Enam topik teknis: ilmu, orang tua, amarah,
lisan, sedekah, makan. Tidak mengandung teks Arab, terjemahan, derajat atau
nomor hadits autentik. Seluruhnya bertanda SIMULASI dan ID SIM-.

Setiap query menyimpan original query, expected topic, alasan serta judgment
relevan/sebagian relevan/tidak relevan untuk seluruh dokumen kanonik. Total
2.048 judgment: 242 relevan, 33 sebagian relevan, 1.773 tidak relevan.
`expectedHadithIdsVerified=null`: tidak ada ID fiktif yang diklaim sebagai
hadits nyata. Partial tidak dihitung sebagai hit pada metrik biner.

Qrels ditulis bersama fixture dan belum ditinjau independen. Pengujian ini
mengukur retrieval label sintetis, bukan relevansi matan atau kebenaran agama.
Kejujuran, akhlak, kebersihan dan kasih sayang pada target pilot nyata tetap
menunggu sumber/kurasi berizin; enam topik fixture tidak menggantikannya.

## Pipeline import dan laporan

Gunakan pipeline NestJS/TypeScript + pg yang sama: schema Zod strict, transaksi,
advisory lock, savepoint, identitas sumber/koleksi/skema/nomor, hash dan
provenance. Teks asli dipertahankan; normalisasi hanya untuk field pencarian.
Input tidak dapat menyetujui sumber, memberi verified, atau mengisi grade palsu.

Tambahan `--dry-run` menjalankan validasi dan upsert yang sama lalu ROLLBACK.
Report membedakan dryRun/committed dan menyertakan path field invalid.
RunId dry-run tidak persisten; angka imported adalah rencana tindakan.
Cara menjalankan ada di [DATABASE.md](DATABASE.md).

Pengujian PostgreSQL pada schema acak terisolasi benar-benar dieksekusi:

| Skenario SIMULASI                           | Hasil                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| Dry-run 3 input: valid + duplikat + invalid | planned imported 1, duplicated 1, failed 1; committed false                |
| Pemeriksaan sesudah dry-run                 | hadiths 0, import_runs 0                                                   |
| Commit fixture ke draft di schema test      | imported 1, duplicated 1, failed 1                                         |
| Ulang fixture identik                       | imported 0, skipped 1                                                      |
| Filter publik dan detail                    | fixture tidak keluar; verified simulation ditolak constraint               |
| Sumber candidate                            | import ditolak SOURCE_NOT_APPROVED                                         |
| Cleanup                                     | hanya schema test yang baru dibuat dihapus; schema aplikasi tidak di-reset |

Failed 1 di atas adalah input invalid yang sengaja diuji; **suite test lulus**.
Konflik duplikat dan update diuji pula dengan client double; reset status
verifikasi diterapkan pipeline, bukan bukti verifikasi ilmiah corpus nyata.
Laporan data quality terstruktur:
[G25_DATA_QUALITY.json](G25_DATA_QUALITY.json). Import nyata belum pernah
dijalankan; laporan historis nyata tetap [G2_IMPORT_REPORT.json](G2_IMPORT_REPORT.json).

## Evaluasi dan verifikasi

`npm run search:evaluate` menjalankan SQL G3 pada tabel TEMP melalui koneksi
Neon langsung, tanpa mengganti view publik. Fixture hilang saat sesi ditutup.
Baseline mesin G2 dan G3, kategori, split 48/16, profil bobot, hash input/corpus,
EXPLAIN ANALYZE dan hasil per-query ada di [G3_BASELINE.json](G3_BASELINE.json).
Penilaian lengkap di [G3_EVALUATION_CASES.json](G3_EVALUATION_CASES.json).
Metrik final dan lebih dari 10 contoh hasil: [G3_REPORT.md](G3_REPORT.md).

Perintah yang dieksekusi dan hasil akhir lint/typecheck/build, 17 unit/HTTP,
3 integrasi Neon, serta regresi browser dijelaskan dalam laporan G3 tersebut,
termasuk percobaan gagal dan perbaikannya. Tidak menyamakan test double,
PostgreSQL fixture, browser contract fixture dan retrieval corpus nyata.

## File dibuat atau diubah untuk G2.5

- `apps/api/src/database/{connection,importer,cli}.ts`: sesi langsung, timeout
  koneksi terpisah, dry-run dan audit read-only.
- `apps/api/test/{database.test,database.integration,search-postgres.integration}.cjs`:
  rollback, field invalid, session state dan regresi retrieval.
- `apps/api/src/modules/search/evaluation/{fixtures,cli}.ts`,
  `apps/api/test/search-intelligence.test.cjs`, `tests/fixtures/g3-search.json`:
  graded judgments dan hasil top-5 berlabel.
- `package.json`, `apps/api/package.json`: db:audit dan cakupan format.
- `docs/DATASET_AUDIT.md`, `docs/G25_REPORT.md`, `docs/G25_DATA_QUALITY.json`,
  `docs/G25_DATABASE_AUDIT.json`, `docs/DATABASE.md`, `docs/SEARCH_ENGINE.md`,
  `docs/G3_*.json`, `decisions/ADR-005.md`, `README.md`, `TASKS.md`: bukti dan status.

## Blocker dan rekomendasi

G4 dengan data nyata **belum layak dimulai**. Dibutuhkan bukti izin konten,
pilot beredisi/bernomor jelas, pemeriksa manusia dan qrels nyata independen.
Tidak ada credentials di laporan/template; nilai lokal tetap di .env yang
diabaikan Git. Tidak ada LLM, Docker, PostgreSQL lokal, embedding, layanan
tambahan, langganan berbayar atau deployment yang dijalankan.
