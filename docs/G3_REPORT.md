# G3 — Hasil implementasi dan pengujian

17 Oktober 2026, Asia/Jakarta. Implementasi lexical dan evaluasi teknis selesai
pada fixture simulasi. **Gate pencarian hadits nyata tetap BLOCKED**: sumber
approved 0, hadits nyata 0, hasil publik 0. G2.5 didahulukan sesuai permintaan;
lihat [G25_REPORT.md](G25_REPORT.md). G4 dan deployment tidak dikerjakan.

## Perubahan dan struktur

```text
apps/api/src/modules/search/
  search.controller.ts          # HTTP/DTO
  search.service.ts             # orkestrasi mock/lexical
  query-normalizer.ts           # salinan query untuk pencarian
  query-analyzer.ts             # kata utama, negasi, frasa, ambiguitas
  search-vocabulary.ts          # alias, typo eksplisit, aturan enam topik
  synonym.service.ts            # ekuivalen vs hubungan topik
  search.repository.ts          # SQL kandidat/ranking/dedup/pagination
  relevance-ranker.ts           # formula dan profil bobot
  evaluation/                   # CLI fixture PostgreSQL dan metrik
    fixtures.ts, metrics.ts, g2-baseline.ts, cli.ts
```

Nest dependency injection dipertahankan. Next hanya menampilkan UI dan
memanggil Nest. Query asli tetap di response/UI; normalisasi NFKC, lowercase,
spasi/tanda baca, variasi hadis/hadist, bahasa informal dan koreksi eksplisit
hanya bekerja pada salinan pencarian. Negasi tidak dihapus; tidak ada stemming
agresif, LLM, embedding atau klasifikasi teks hadits oleh AI.

Kamus membedakan ibu/bunda dari ayah/bapak, infak/infaq dari sedekah terkait,
dan hubungan topik enam kelompok. Memberi/kanan sendiri tidak memberi topik
agama otomatis. Konteks ibu kota/ibu jari diperiksa pada query dan dokumen.
Query ambigu mengembalikan status tambahan yang kompatibel dan hint UI;
tetap mengakses DB, sehingga outage tidak berubah menjadi hasil kosong palsu.

PostgreSQL menggabungkan FTS simple, keyword, frasa, topik kurasi, bab dan
strict-word trigram. Sinyal utama berbobot lebih tinggi daripada related term.
SQL parameterized, satu snapshot count/pagination, limit 20, page maksimum 10,
tie-break stabil. Dedup berdasarkan sumber+koleksi+skema+nomor; teks sama dari
koleksi berbeda dipertahankan. Grade tidak memengaruhi ranking.

Migration 003 menambahkan topic_slugs ke view yang tetap memfilter
approved+verified+non-simulation; 001/002 tidak diedit. Indeks GIN FTS/trigram,
publikasi/koleksi dan relasi topik yang ada dipakai. Tidak ada indeks vector.
Rincian formula, bobot, kamus, indeks dan batasnya: [SEARCH_ENGINE.md](SEARCH_ENGINE.md).
Kontrak utama POST /api/v1/search dipertahankan; meta.queryStatus opsional.

## Baseline final — SIMULASI SAJA

Run 2026-10-16T23:52:15.343Z = 17 Oktober 2026 WIB. Dataset 64 query:
55 positif, 5 ambigu, 4 negative/no-result; 33 row TEMP/32 dokumen kanonik.
Qrels lengkap pada fixture: relevan/partial/irrelevan. Partial tidak dihitung
sebagai hit. Hadith IDs nyata tetap null; metrik hadits nyata **unavailable**.

| Metrik                                | G2 historis, fixture yang sama | G3 final, fixture |
| ------------------------------------- | -----------------------------: | ----------------: |
| Precision@5, 55 positif               |                         0.5345 |            0.8800 |
| Recall@10, hanya gold fixture lengkap |                         0.6770 |            1.0000 |
| MRR@10, 55 positif                    |                         0.8091 |            0.9909 |
| Hit Rate@5, 55 positif                |                         0.8364 |            1.0000 |
| Zero-result rate, semua 64            |                         25.00% |          14.0625% |
| No-result accuracy, 9 negatif/ambigu  |                         77.78% |              100% |
| Topic routing accuracy, semua 64      |                            N/A |              100% |
| Latensi SQL roundtrip p50             |                      255.32 ms |         263.58 ms |
| Latensi SQL roundtrip p95             |                      262.76 ms |         516.59 ms |

P@5 membagi lima meskipun gold relevan kurang dari lima: ceiling fixture ini
0.88 (242 gold / 55 / 5), sehingga nilai ini tidak berarti akurasi produksi 88%.
Recall sah hanya untuk 32 dokumen sintetis yang dinilai lengkap. Nol hasil
9/64 adalah hasil yang memang diharapkan; bukan sembilan query positif gagal.
Latensi adalah satu run berurutan melalui jaringan Neon, bukan HTTP/UI atau SLA.
G3 lebih lambat pada p95 run ini; tidak mengklaim optimasi latency sudah terbukti.

| Kategori           | Query |    P@5 | MRR@10 | Zero-result |
| ------------------ | ----: | -----: | -----: | ----------: |
| Exact keyword      |    15 | 0.9200 | 1.0000 |          0% |
| Informal           |    10 | 0.8800 | 1.0000 |          0% |
| Sinonim            |    11 | 0.6909 | 0.9545 |          0% |
| Typo eksplisit     |     8 | 1.0000 | 1.0000 |          0% |
| Panjang            |     2 | 1.0000 | 1.0000 |          0% |
| Negasi             |     9 | 0.9111 | 1.0000 |          0% |
| Ambigu             |     5 |    N/A |    N/A |        100% |
| Negative/no-result |     4 |    N/A |    N/A |        100% |

48 query kalibrasi/16 holdout ditetapkan sebelum run. Balanced, coverage dan
phrase seri pada kalibrasi: P@5 0.90, MRR@10 0.9881. Balanced dipertahankan
sesuai aturan tie yang terdokumentasi; tidak diklaim optimal. Holdout P@5
0.8154, MRR/Hit@5 1.0 pada 13 positif. Profil memakai rescore fitur yang sama,
bukan benchmark latency terpisah. Qrels dibuat bersama fixture, belum ditinjau
independen; holdout bukan bukti generalisasi ke hadits nyata. Aturan konteks
diperbaiki setelah inspeksi fixture, sehingga ini baseline pengembangan,
bukan evaluasi buta. Duplikat sengaja dibuat meski UNIQUE normal mencegahnya;
keunggulan terhadap baseline G2 tidak seluruhnya dapat digeneralisasi.

## Contoh hasil yang benar-benar dijalankan

Semua ID di bawah menunjuk **label simulasi TEMP**, bukan hadits. R = relevan,
P = sebagian relevan. Penilaian lengkap beserta label/reason/top-5 berada di
[G3_BASELINE.json](G3_BASELINE.json); gold di [G3_EVALUATION_CASES.json](G3_EVALUATION_CASES.json).

| Query asli                                     | Hasil awal                               | Penilaian top-5 dan alasan                                          |
| ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Hadits tentang menuntut ilmu                   | SIM-knowledge-1 (R), SIM-knowledge-2 (R) | 3 R, 2 P; pengetahuan/pendidikan lebih luas daripada frasa spesifik |
| Minta hadist soal belajar                      | SIM-knowledge-1 (R), SIM-knowledge-5 (R) | 5 R; label topik belajar                                            |
| Hadits tentang hormat sama ibu                 | SIM-parents-2 (R), SIM-parents-1 (R)     | 3 R, 2 P; label ayah/umum partial, ibu kota tidak ikut              |
| Berbakti ke bapak dan ibu                      | SIM-parents-3 (P), SIM-parents-1 (R)     | 1 R, 4 P; gabungan ayah+ibu baru rank 2, keterbatasan ranking       |
| Hadis soal jangan marah                        | SIM-anger-1 (R), SIM-anger-3 (R)         | 5 R; negasi/frasa dipertahankan                                     |
| hadits tentang mrah                            | SIM-anger-1 (R), SIM-anger-3 (R)         | 5 R; typo eksplisit mrah→marah                                      |
| Jangan berbohong                               | SIM-speech-3 (R), SIM-speech-1 (P)       | 1 R, 4 P; lisan umum belum menyebut bohong                          |
| hadis infaq                                    | SIM-charity-2 (R), SIM-charity-3 (P)     | 1 R, 4 P; infak/infaq setara, berbagi hanya terkait                 |
| Kasih dong hadis soal donasi                   | SIM-charity-4 (R), SIM-charity-3 (P)     | 1 R, 4 P; hanya satu label menyebut donasi                          |
| Rasulullah mengajarkan makan pakai tangan apa? | SIM-eating-1 (R), SIM-eating-4 (R)       | 5 R pada topik fixture; tidak menghasilkan jawaban agama            |
| membaca basmalah sebelum makan                 | SIM-eating-2 (R), SIM-eating-1 (P)       | 1 R, 4 P; adab makan umum belum menyebut basmalah                   |
| Hadits tentang ini dong                        | kosong, ambiguous                        | 0 hasil; meminta topik, tidak mengarang maksud                      |

## Perintah dan hasil akhir

Runtime Node 24.22.0 LTS/npm 11.19.1 dari .tools (Git-ignored), Windows x64.
Perintah root menggunakan PATH portable sesuai README. Build/test yang menulis
dist diselesaikan sebelum watcher dijalankan.

| Perintah                | Hasil eksekusi                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| npm run lint            | exit 0, API + web, tanpa warning                                                                                       |
| npm run typecheck       | exit 0, API + Next typegen/web + e2e TypeScript                                                                        |
| npm test                | exit 0, 17 passed, 0 failed/skipped; unit dan HTTP lokal dengan DB double                                              |
| npm run test:db         | exit 0, 3 passed, 0 failed/skipped; PostgreSQL nyata dengan fixture terisolasi dan HTTP lexical terhadap corpus kosong |
| npm run build           | exit 0, Nest build + Next optimized build, / dan /_not-found                                                           |
| npm run db:audit        | exit 0; seluruh jumlah corpus aplikasi 0, tiga migrasi tercatat                                                        |
| npm run search:evaluate | exit 0, 64/64; metrics, judgments dan EXPLAIN tersimpan                                                                |
| npm run dev             | kedua server siap: Next 3000, Nest 4000; watcher 0 errors                                                              |
| npm run test:smoke      | exit 0, 4 pemeriksaan HTTP/Tailwind/health/CORS/search lulus                                                           |
| npm run test:e2e        | exit 0, 18 passed (2.6 menit): 9 desktop + 9 mobile, tanpa retry                                                       |
| npm run format:check    | exit 0, seluruh file yang dicakup sesuai Prettier                                                                      |

Tes PostgreSQL meliputi migrasi/checksum/idempotency, dry-run rollback,
draft/source gating, constraint simulasi, injection, ranking, negasi, konteks
ibu kota, dedup identitas, koleksi berbeda, pagination dan filter. HTTP nyata
terhadap DB kosong membuktikan kontrak/koneksi, **bukan retrieval hadits nyata**.
EXPLAIN ANALYZE fixture 33 row tidak membuktikan efisiensi indeks skala besar.

## Percobaan gagal dan perbaikan

- Percobaan sandbox db:check awal gagal generic DATABASE_OPERATION_FAILED;
  koneksi TLS kemudian berhasil dengan akses jaringan yang diizinkan.
- Tes integrasi pertama dijalankan saat dist dibangun: HTTP gagal module
  app.module tidak ditemukan. Build dan tes kemudian diurutkan; tidak diulang
  bersamaan dengan watcher.
- TEMP relation hilang (42P01) pada transaction pooler. Pengujian sesi/schema
  memakai endpoint direct Neon; tidak ada bypass view publik.
- HTTP lexical sempat 503 karena koneksi pooler melewati 5 detik. SELECT 1
  nyata berhasil sekitar 6.2 detik dengan batas 10 detik. Timeout koneksi
  dipisahkan dari SQL 5 detik; suite HTTP/DB final lulus.
- npm test sandbox sempat 14/17; tiga HTTP gagal EACCES loopback. Ulang dengan
  akses loopback yang diizinkan: 17/17, tanpa mengurangi assertion.
- Typegen sandbox gagal SWC canonicalization Access denied Windows. Perintah
  sama di luar sandbox lulus; tidak mengubah Next/tsconfig untuk mengakali tes.
- Lint menangkap dua unsafe assignment pada hasil audit pg. Tambahkan tipe
  hasil query; lint final lulus. Tidak menonaktifkan aturan ESLint.
- Inspeksi baseline menemukan ibu kota pada top-5 query ibu; konteks dokumen
  ditambahkan dan baseline diulang. Fixture/versi final ditandai hash dalam JSON.

## Daftar file dibuat/diubah

- Search runtime: query-normalizer.ts, query-analyzer.ts, search-vocabulary.ts,
  synonym.service.ts, relevance-ranker.ts, search.repository.ts,
  search.service.ts, search.module.ts, search.schema.ts. lexical-query.ts lama
  digantikan; algoritme historis hanya tersisa pada evaluation/g2-baseline.ts.
- HadithRepository/serializer membatasi DTO publik dan menampilkan topik kurasi
  opsional; db/migrations/003_curated_topics.sql memperkaya view.
- evaluation/{fixtures,metrics,g2-baseline,cli}.ts dan root search:evaluate.
- Database connection/importer/cli serta db:audit/dry-run: daftar G2.5 pada
  G25_REPORT.md. Tidak menambah dependency untuk G3.
- apps/web/lib/api-client.ts dan apps/web/features/search/{types.ts,search-results.tsx}: guard
  queryStatus opsional, hint ambigu, query asli. Kontrak openapi diperbarui.
- apps/api/test/{database.test,search-intelligence.test,search-postgres.integration,
  search-http.integration,database.integration}.cjs; tests/fixtures/g3-search.json;
  tests/e2e/{chat,database-contract}.spec.ts dan playwright.config.ts.
- TASKS.md, README dan README per app, docs/{SEARCH_ENGINE,G3_REPORT,G3_BASELINE,
  G3_EVALUATION_CASES,G25_REPORT,G25_DATA_QUALITY,G25_DATABASE_AUDIT,DATASET_AUDIT,
  DATABASE,G2_REPORT,G2_IMPORT_REPORT}, decisions/ADR-005.md, package.json.
- apps/api/.env.example dibersihkan dari credentials; .env lokal dipertahankan
  dan diabaikan Git. Evidence browser G3 berada di docs/evidence/g3-*.

## Kriteria dan sisa risiko

Normalisasi/sinonim/topik, SQL multisinyal, ranking/dedup/pagination, kontrak,
fixture >=50, runner/baseline, unit/integrasi, mock separation dan build/lint/
typecheck teruji. Regresi browser 18, smoke 4 dan format juga lulus.
G2.5 memenuhi jalur simulasi; G2/G3 **belum lulus gate data nyata**.

Kamus/typo terbatas; tidak memahami seluruh bahasa Indonesia atau menyelesaikan
logika negasi. Query gabungan bapak+ibu menunjukkan rank-1 partial; perbaikan
berikutnya harus dievaluasi pada qrels independen. Pencarian Arab langsung belum
diindeks. Belum ada pengukuran pada corpus ratusan/ribuan record atau latensi
produksi. Lisensi, pasangan teks/edisi, verifikasi manusia dan qrels nyata
tetap memblokir real-data sign-off dan kesiapan G4. TASKS mempertahankan blocker.

Evidence browser: docs/evidence/g3-* dan artifacts/g3/e2e-results.json (lokal,
Git-ignored). Screenshot desktop/mobile hasil dan contract fixture diperiksa
secara visual: label simulasi jelas, detail/RTL tetap terbaca, tanpa overflow.
Audit 158 file teks source/bundle tidak menemukan nilai credentials backend;
fixture hash cocok, 64 actual verified hadith IDs tetap null, dan jumlah qrels
sesuai laporan data quality. .env backend/web dikonfirmasi Git-ignored.
