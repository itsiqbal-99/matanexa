# G2.6 — Pilot hadits nyata di localhost

Laporan ini mencatat tahap lexical/fallback awal. Pengguna kemudian mengizinkan
indexing Cloudflare dan A/B semantic; hasil terbaru ada di
[G26_HYBRID_REPORT.md](G26_HYBRID_REPORT.md). Angka dan kendala tahap awal berikut
dipertahankan sebagai riwayat, bukan status indeks saat ini.

17 Oktober 2026. Lexical dan fallback diprioritaskan sesuai arahan pengguna.
Corpus nyata telah diimpor untuk riset development; **bukan corpus publik atau
hadits yang sudah ditinjau manusia**. Tidak ada deployment atau LLM generatif.

## Corpus dan provenance

Sumber: [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api),
revisi `df57907be35291c91ad6a6691180e22ca9920784`.
Edisi `ind-bukhari` dan `ara-bukhari`, masing-masing 7.589 entri. Dipilih seluruh
bagian makanan/adab, wahyu serta sampel ilmu/zakat. 417 identitas dipilih,
404 diterima dan 13 ditolak karena teks kosong/invalid. Tidak mengisi kekosongan.

Nomor yang ditolak: 5404, 5441.2, 5454, 5464, 5979, 5982, 6066, 6067, 6072,
6075, 6090, 6175 dan 4. Nomor disimpan string, tidak dipaksa integer.

Pairing memeriksa koleksi, nomor, arabicnumber, reference kitab/hadits dan
metadata section. Bukan zip array. Setiap raw_record menyimpan URL edisi
yang dipatok, revisi, nomor, hash dan `pairingStatus=identity_matched`,
`humanReview=pending`. Arab/Indonesia disimpan verbatim. Grade tidak diimpor.

| File sumber      | SHA-256                                                          |
| ---------------- | ---------------------------------------------------------------- |
| ind-bukhari.json | a3005e17d00578bc4937f2c43575c2a3883c5f848c25ca66b064d92f5144bafb |
| ara-bukhari.json | e34a3402889ca378871da3c5984b7875c680920e93f1c8738ac7afe502179562 |

Import pertama: imported 404, updated/skipped/failed 0. Import ulang:
imported/updated 0, skipped 404, failed 0. Dry-run: committed false,
planned imported 404, failed 0. Pipeline transaksi/hash yang sama digunakan;
jalur riset dioptimalkan menjadi batch atomik agar tidak melakukan ribuan
roundtrip jaringan. Snapshot aplikasi: local_pilot 404, published 0,
approved_sources 0, embeddings belum diindeks.

Audit akhir memeriksa seluruh 404 teks Arab, Indonesia, content_hash dan status
terhadap input pilot: **404 cocok, 0 kegagalan**, semuanya draft/humanReview pending.

Izin terjemahan upstream belum tuntas. Sumber tetap `research_only`, record
tetap draft, isVerified false. Rujukan tiga anchor dibandingkan sebagai
referensi awal; ini bukan tinjauan manusia independen seluruh corpus. Tidak
melakukan scraping hadits.in atau mengimpor database superXdev.

## Implementasi dan batas akses

Migrasi 004 menyediakan view local_pilot_hadiths tanpa mengubah filter publik.
Migrasi 005 menyediakan pgvector(1024) dan penyimpanan hash/model. Scope dipilih
environment server, bukan parameter HTTP. Pilot memerlukan NODE_ENV development,
loopback socket dan Host localhost; respons no-store. Production menolak scope.
UI menampilkan label riset, Arab RTL, terjemahan asli dan provenance; grade
Belum tersedia. Copy diblokir; data pilot tidak ditulis/dipulihkan localStorage.

Lexical memakai FTS simple, trigram, aturan konteks dan frasa yang dikurasi
sebagai aturan retrieval, bukan klasifikasi hadits. Indeks turunan mengabaikan
prefix sebelum kutipan pertama dan mempertahankan seluruh dialog berikutnya.
Teks tanpa kutipan tetap diindeks penuh. Normalisasi imbuhan terbatas hanya
pada salinan pencarian. Sinyal kata dinormalkan terhadap panjang dokumen.
Tidak ada nomor/ID anchor yang di-hardcode untuk ranking.

Provider REST memvalidasi respons, 1024 finite/nonzero, batch dan timeout 4s.
Indeks kosong dideteksi sebelum query embedding. Error provider menghasilkan
lexical_fallback; DB gagal tetap 503. Cosine top100 dan RRF k=60 tersedia,
tetapi indexing corpus dan perbandingan semantic nyata **belum dijalankan**.
Permintaan hybrid pada evaluasi hanya mengukur fallback. Pada percobaan awal,
query embedding sempat dipanggil sebelum pemeriksaan index kosong ditambahkan;
tidak ada bukti biaya/kuota akun yang dapat dilaporkan sebagai Rp0 terverifikasi.
Tidak ada aktivasi layanan berbayar atau indexing batch.

## Evaluasi dan pengujian

Evaluasi final 17 Oktober 2026 05:09 UTC, DB_TIMEOUT_MS=10000.
Artefak lokal: artifacts/g26/evaluation.json,
pairing-report.json, import-first.json, import-repeat.json dan browser-results.json.
File dengan teks corpus/screenshot tidak didistribusikan atau ditambahkan Git.
Metadata hasil tanpa teks lengkap akan disimpan di G26_RESULTS.json.

Judgment pada tests/pilot/queries.json dibuat dengan membaca isi Indonesia
dan tiga anchor dari pengguna; bukan label otomatis karena kata sama. Beberapa
alternatif relevan dicatat dengan alasan. Hasil lain tetap unjudged. Tidak ada
review manusia independen. Sepuluh query juga dipakai untuk tuning, sehingga
angka adalah pilot development, bukan benchmark holdout. P@5 adalah batas bawah
judged-positive, bukan penilaian lengkap seluruh kandidat. Recall tidak diklaim.

| Mode diminta → mode aktual                  | Hit Rate@5   | MRR@10       | P@5 batas bawah | p50 / p95 HTTP    |
| ------------------------------------------- | ------------ | ------------ | --------------- | ----------------- |
| lexical → lexical                           | 1,00         | 0,9333       | 0,30            | 1.132 / 6.546 ms  |
| hybrid → lexical_fallback (INDEX_NOT_READY) | 1,00         | 0,9333       | 0,30            | 1.841 / 12.556 ms |
| hybrid semantic nyata                       | Belum diukur | Belum diukur | Belum diukur    | Belum diukur      |

Tidak ada query kosong. Latency mencakup koneksi Neon dan transfer hasil,
dipengaruhi kondisi development/jaringan; bukan benchmark beban terisolasi.
Fallback mengambil kandidat lexical lebih banyak untuk persiapan hybrid,
sehingga belum secepat mode lexical. p95 fallback melebihi timeout UI 10 detik;
optimasi latency dan semantic A/B tetap pekerjaan lanjutan. Demo akhir memakai
lexical, bukan hybrid. Satu run sebelumnya gagal HTTP 503; tidak diganti mock.

| Query                       | Top 5 nomor Bukhari aktual   | Rujukan relevan yang dinilai                       |
| --------------------------- | ---------------------------- | -------------------------------------------------- |
| P01 tangan apa saat makan   | 5376, 1410, 5377, 5398, 5399 | 5376 (rank 1)                                      |
| P02 tangan kanan            | 5376, 5377, 5398, 5399, 5386 | 5376 (rank 1)                                      |
| P03 lauk jauh               | 5376, 5446, 6111, 6150, 1413 | 5376 (rank 1); 5377 juga dinilai relevan           |
| P04 bismillah sebelum makan | 5376, 5378, 5458, 5377, 5398 | 5376 (rank 1)                                      |
| P05 gampang emosi           | 6116, 6048, 6113, 6078, 6114 | 6116 dan 6114                                      |
| P06 menahan amarah          | 6116, 6114, 6223, 5400, 6226 | 6116 dan 6114                                      |
| P07 ibu sebelum ayah        | 6184, 5973, 5971, 5383, 6193 | 5971 (rank 3)                                      |
| P08 berbakti orang tua      | 5970, 5972, 5975, 5973, 6091 | 5970 (rank 1); 5971/5974/5976 juga dinilai relevan |
| P09 niat                    | 1, 1396, 1397, 5974          | 1 (rank 1; hanya 4 hasil)                          |
| P10 menjaga ucapan          | 6135, 6019, 6018, 6136, 6138 | 6135, 6019, 6018 dan 6136                          |

Masih ada hasil yang tidak menjawab intent walau berbagi kata; Hit@5=1 tidak
berarti semua kartu relevan. Contoh 1410 pada P01 membahas sedekah, bukan
instruksi tangan saat makan. Corpus hanya 404, tema tidak seimbang, belum ada
holdout atau judgment lengkap semua kandidat. Tidak mengklaim G3 publik lulus.

Percobaan awal lexical: Hit@5 0,4, MRR@10 0,2808, P@5 anchor 0,08. Kata umum
sanad mendominasi. Pemilihan pasangan kutipan ternyata menghapus dialog
bersarang (5971); diperbaiki dengan mengambil semua teks setelah kutipan awal.
Percobaan antara sempat gagal PILOT_EVALUATION_FAILED tanpa diagnosis spesifik;
run lain gagal DEVELOPMENT_DATABASE_REQUIRED karena NODE_ENV belum development.
Panjang dokumen sempat menurunkan ranking pertanyaan tangan; aturan konteks
tangan saat makan ditambahkan. Seluruh percobaan tidak dianggap lulus otomatis.

Lint awal gagal karena posisi use-client directive dan non-null assertion;
keduanya diperbaiki. Tes Host awal gagal karena fetch tidak mengirim custom
Host seperti dimaksud; tes diperbaiki memakai node:http. Format awal sempat
diinterupsi. Hasil akhir dan keterbatasan dicatat sesudah pengujian selesai.

## File yang dibuat/diubah

- db/migrations/004_local_research_pilot.sql, 005_embedding_storage.sql.
- apps/api/src/database: corpus-access.ts, database.module.ts,
  database.service.ts, importer.ts, pilot.ts, pilot.cli.ts,
  index-embeddings.cli.ts.
- apps/api/src: config/environment.ts, create-app.ts, modules/health/health.service.ts,
  modules/hadiths/hadith.repository.ts, modules/search/search.module.ts,
  search.service.ts, search.repository.ts, query-normalizer.ts, query-analyzer.ts,
  search-vocabulary.ts, synonym.service.ts, relevance-ranker.ts, semantic.repository.ts,
  evaluation/pilot.cli.ts, providers/embedding/cloudflare-embedding.ts.
- apps/web/features/search: types.ts, result-card.tsx, search-results.tsx,
  search-workspace.tsx, use-workspace.ts, storage.ts; apps/web/lib/api-client.ts.
- apps/api/test: pilot.test.cjs, pilot.integration.cjs, database.test.cjs,
  search-http.integration.cjs; tests/pilot/queries.json, local-pilot.spec.ts;
  playwright.pilot.config.ts, tsconfig.e2e.json.
- package.json, apps/api/package.json, .gitignore, apps/api/.env.example,
  README.md, TASKS.md, contracts/openapi.yaml, decisions/ADR-006.md,
  docs/04_DATA_GOVERNANCE.md, DATABASE.md, SEARCH_ENGINE.md, DATASET_AUDIT.md,
  G26_REPORT.md, G26_RESULTS.json. .env lokal hanya nilai scope/mode/development
  yang diubah; kredensial tidak disalin ke contoh atau laporan.

## Menjalankan

apps/api/.env: NODE_ENV=development, APP_DATA_SCOPE=local_pilot,
APP_SEARCH_MODE=lexical; DATABASE_URL tetap rahasia di file tersebut.
Root `npm run dev`: http://localhost:3000 dan
http://localhost:4000/api/v1/health. Panduan impor/reindex/evaluasi ada di README.

## Bukti final dan status acceptance

| Perintah yang benar-benar dijalankan | Hasil final                                                         |
| ------------------------------------ | ------------------------------------------------------------------- |
| npm test                             | 23 pass, 0 fail, 0 skipped                                          |
| npm run test:db                      | 5 pass, 0 fail, 0 skipped; PostgreSQL/sumber nyata                  |
| npm run lint                         | Kedua workspace lulus, 0 warning                                    |
| npm run typecheck                    | API, web dan tes browser strict lulus                               |
| npm run build                        | Nest dan Next optimized build lulus                                 |
| npm run test:smoke                   | 4 PASS pada root dev mode mock                                      |
| npm run test:e2e                     | 18 pass desktop/mobile, termasuk error/timeout/keyboard             |
| npm run test:pilot                   | 2 pass desktop/mobile, tiap tes 3 query anchor melalui API/DB nyata |
| npm run pilot:evaluate               | 20 request nyata; 10 lexical + 10 fallback; metrik di atas          |
| npm run format:check                 | Pemeriksaan final seluruh target format                             |

Tes pilot membandingkan Arab/Indonesia di modal dengan file sumber asli,
memeriksa RTL, label riset, tidak ada grade, larangan copy/save dan tidak ada
persistensi corpus. Enam screenshot lokal diperiksa; desktop/mobile 5376
ditinjau visual. Audit secrets pada source/dokumen/bundle tidak menemukan
kredensial yang terkonfigurasi (0 kecocokan); file .env, data dan artefak
terbukti Git-ignored. Respons health dan web final HTTP 200, CORS localhost
benar, Cache-Control no-store. Root dev ditinggalkan dalam mode lexical pilot.

Percobaan root dev awal sempat gagal EADDRINUSE karena server Matanexa lama
masih hidup; proses proyek diidentifikasi lalu direstart memakai Node LTS.
Satu run integrasi dihentikan saat adapter menghitung ulang hash file penuh
untuk setiap record; hash kini dihitung sekali per edisi. Run final 5 tes lulus.
Kegagalan sebelumnya tidak dihapus dari penjelasan dan bukan klaim keberhasilan.

Database nyata, pasangan teks, query natural, tiga anchor dan integrasi localhost
**lulus untuk pilot lexical**. Isolasi scope publik teruji. Fallback tanpa index
serta error provider teruji; latency fallback masih memiliki keterbatasan di atas.
Hybrid semantic nyata, izin publikasi dan tinjauan manusia independen **belum
selesai**. G2/G3 publik dan gate G4 penuh tidak ditandai lulus. Tidak ada
deployment, redesign UI, LLM lokal, Docker atau PostgreSQL lokal.
