# G2.6 — Integrasi hybrid semantic dan kesiapan G4

17 Oktober 2026, Asia/Jakarta. Pengguna secara eksplisit mengizinkan Cloudflare
Workers AI untuk corpus pilot setelah tahap lexical/fallback. Arsitektur tetap
Next.js → NestJS → Neon PostgreSQL/pgvector; tidak ada deployment/model lokal.

## Koneksi, indeks dan penggunaan

Satu probe koneksi berhasil HTTP 200, model `@cf/baai/bge-m3`, 1 vector ×1024,
latency 1.074 ms. Kredensial tidak dicetak. Provider memvalidasi jumlah vector,
1024 finite/nonzero, ukuran input/respons, dan timeout 4 detik.

Index awal: eligible 404, indexed **404**, failed **0**, unprocessed **0**,
retry **0**. Total 101 request sukses, 404 teks, 313.242 karakter / 313.258 byte.
Cloudflare melaporkan **135,9783489115002 neuron** untuk indexing. Token count
tidak tersedia; nol pada field token artefak awal adalah default counter lama,
bukan klaim bahwa input tidak memakai token. Counter baru memakai null ketika
usage tersebut tidak dilaporkan. Repeat index: alreadyIndexed 404, indexed 0,
failed 0, **request API 0**.

Input embedding adalah terjemahan Indonesia asli, verbatim, bukan teks yang
dibuat atau diterjemahkan AI. Arabic/Indonesia, metadata asli, hash dan status
hadits tidak diubah. Penyimpanan memakai primary key hadith_id+model dan
content_hash sumber; hash mencakup teks/metadata/provenance input importer.
Query/reindex mengabaikan vector dengan hash usang. Batch upsert parameterized
memeriksa ulang scope/hash tepat sebelum penyimpanan. Tidak ada ANN untuk 404 row.
Teks Indonesia dikirim ke Cloudflare untuk proses embedding yang diotorisasi
pengguna; corpus/UI tetap dibatasi development lokal dan database development.

Batch 4 teks, jeda 100ms; maksimal satu retry timeout/5xx. Auth/quota tidak
diulang otomatis. Gagal batch berhenti resumable; run berikutnya hanya mengisi
record yang belum punya model/hash yang sesuai. Report tidak menyimpan token,
account ID, prompt, vector atau raw response.

Usage neuron berasal dari metadata respons provider, bukan estimasi karakter.
[Dokumentasi pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
menyebut alokasi gratis 10.000 neuron/hari dan BGE-M3 1.075 neuron per sejuta
input token. Tidak mengaktifkan paket/billing berbayar; penggunaan akun lain,
sisa alokasi akun dan invoice aktual tidak dapat disimpulkan dari metadata run.
[Dokumentasi model](https://developers.cloudflare.com/workers-ai/models/bge-m3/)
menyediakan REST text-array yang digunakan. Tidak mengirim hadits ke model generatif.

## Retrieval dan fallback

Setelah readiness diperiksa, lexical top100 dan query embedding berjalan
bersamaan. Vector cosine mengambil top100 dari view scope yang sama dan hash
terkini. Fusion RRF `1/(60+rankLexical)+1/(60+rankSemantic)`, ID dedup dan
pagination dipertahankan; daftar gabungan dibatasi 200 kandidat, bukan exhaustive
recall. Tidak ada nomor hadits yang menjadi aturan ranking.

Tidak ada config/index atau query ambigu → lexical fallback dengan pagination
biasa, tanpa scan 100 kandidat maupun request embedding yang tidak perlu.
Provider timeout, shape invalid, quota/error → lexical_fallback. Kegagalan
database/readiness/vector → 503; tidak menyajikan mock seolah corpus nyata.

## Evaluasi nyata

Benchmark awal selesai; pengujian akhir setelah optimasi payload sedang berjalan. File kasus
tests/pilot/hybrid-queries.json memuat 30 query: 10 kalibrasi lama +20 parafrasa
yang ditetapkan sebelum melihat hasil semantic. Expected IDs dipetakan dari
nomor ke UUID database nyata. Alasan isi memakai judgment tahap sebelumnya,
bukan sekadar kata yang sama. Shared-intent paraphrases bukan sampel independen
atau tinjauan manusia/ilmiah. Hasil di luar qrels tetap unjudged; P@5 batas bawah,
tidak ada klaim recall seluruh kitab. Latency HTTP mencakup request sampai
response headers dan tidak mencakup parsing JSON client. Jaringan/cold start
Neon berpengaruh; bukan benchmark beban terisolasi.

Pada 30 query awal seluruh permintaan hybrid benar-benar mode hybrid (30/30,
tanpa fallback), 30 request API berhasil, 0 gagal, **0,4040450386496293 neuron**
yang dilaporkan provider. Hasil awal sebelum optimasi transfer SQL:

| Split             | Mode    | Hit@5  | MRR@10 | P@5 batas bawah |
| ----------------- | ------- | ------ | ------ | --------------- |
| Semua 30          | lexical | 0,6333 | 0,5087 | 0,1867          |
| Semua 30          | hybrid  | 0,8000 | 0,5872 | 0,2000          |
| Kalibrasi lama 10 | lexical | 1,0000 | 0,9333 | 0,3000          |
| Kalibrasi lama 10 | hybrid  | 1,0000 | 0,8250 | 0,2800          |
| Parafrasa baru 20 | lexical | 0,4500 | 0,2963 | 0,1300          |
| Parafrasa baru 20 | hybrid  | 0,7000 | 0,4683 | 0,1600          |

Hybrid memperbaiki coverage parafrasa namun tidak selalu ranking query lama.
Contoh peningkatan: H01 (tangan sebelah mana) 5376 rank8→1; H06 (menyebut nama
Allah saat mulai makan) 5376 tidak di top10→rank3; H09 (mama/papa) 5971 rank5→1;
H08 (naik darah) rujukan relevan rank8→3. Contoh regresi: P03 (lauk jauh)
5376 rank1→4, P05 nasihat emosi rank1→2. H03, H05, H14, H15, H16, H18 belum
memunculkan anchor yang dinilai pada top10. Kata/cerita terkait dapat menggeser
pesan yang dimaksud. Tidak menambah qrels setelah melihat kegagalan agar skor
terlihat lebih baik; hasil unjudged bukan otomatis dinilai salah.

Latency awal lexical p50/p95 1.182/3.388ms, hybrid 5.071/9.472ms. Satu tes
integrasi paralel sempat mendapat HTTP503 pada koneksi DB default, tidak
diganti hasil mock. Retrieval kemudian dibatasi hanya 22 field yang dibutuhkan
serializer, tanpa mengirim raw_record, index text dan fitur ranking berulang
untuk 100 kandidat. Ranking, bobot RRF dan qrels tidak diubah. Run awal tetap
tersimpan di before-projection-optimization.json. Uji ulang memakai batas DB
yang sama dengan benchmark awal (10 detik); suite integrasi memakai konfigurasi
development sebenarnya.

Run final setelah pembatasan payload, 17 Oktober 2026 05:39 UTC:

| Mode diminta | Mode aktual                   | Hit@5  | MRR@10 | P@5 batas bawah | p50 / p95        |
| ------------ | ----------------------------- | ------ | ------ | --------------- | ---------------- |
| lexical      | 30 lexical                    | 0,6333 | 0,5087 | 0,1867          | 687 / 2.448 ms   |
| hybrid       | 29 hybrid +1 lexical_fallback | 0,8000 | 0,6094 | 0,2133          | 3.834 / 7.844 ms |

H20 mengalami timeout Workers AI dan dikembalikan sebagai lexical_fallback
dengan HTTP200 dan hasil lexical. Jadi skor akhir adalah perilaku sistem dengan
fallback, bukan 30 query semantic murni. Perbedaan skor dari run awal terutama
berasal dari fallback H20; optimasi field tidak mengubah ranking. Tidak menghapus
timeout atau mengulangnya sampai terlihat sempurna. Di antara 20 parafrasa,
Hit@5 final lexical 0,45 → hybrid/fallback 0,70, MRR@10 0,2963 → 0,5017.
Run final mencatat 30 request embedding, 29 berhasil, 1 timeout,
0,3900753963558921 neuron yang dilaporkan dari respons sukses. Konsumsi remote
dari request timeout tidak diketahui. Durasi lebih rendah dibanding run awal,
namun variasi jaringan/cold start membuat perbedaan ini bukan bukti kausal
benchmark terisolasi. Hybrid tetap lebih lambat daripada lexical.

Artefak lengkap lokal di artifacts/g26-hybrid (Git-ignored). Ringkasan tanpa
teks corpus akan disimpan di G26_HYBRID_RESULTS.json. Snapshot lexical/fallback
sebelumnya di G26_RESULTS.json tetap dipertahankan.

## Pembatasan dan kesiapan

Dataset tetap 404 draft dari sumber research_only, humanReview pending, grade
null. APP_DATA_SCOPE local_pilot memerlukan NODE_ENV development, Host localhost,
loopback, no-store; copy/save/persistensi corpus di UI diblokir. Vector public
memakai published_hadiths yang tetap approved+verified. Tidak ada auto approval.
Lisensi terjemahan dan tinjauan manusia independen belum selesai. Fondasi teknis
G4 (provider, indeks idempotent, cosine/RRF, fallback, benchmark nyata) tersedia
dan teruji untuk pilot. **Gate publik G2/G3/G4 belum lulus** karena approved dan
verified publik tetap 0. Cache opsional belum dibuat. Sebelum G4/G5 sign-off data,
perlu izin konten, verifikasi manusia, qrels independen yang mencakup query
negatif/di luar corpus, serta perbaikan query yang masih meleset dan latency.

## Verifikasi final

- npm test: 26 pass, 0 fail, 0 skipped.
- npm run test:db: 6 pass, 0 fail, 0 skipped pada run akhir. Termasuk live Cloudflare,
  tiga simulasi kegagalan provider melalui HTTP/DB nyata, DB503 tanpa mock dan
  vector public kosong meskipun 404 vector riset tersedia.
- Audit database: vector model BGE-M3 404×1024, seluruh hash cocok; 404/404 teks
  Arab/Indonesia dan hash sumber tetap sama, mismatch 0, draft 404, publik 0.
- Source/dokumen/bundle diperiksa terhadap kredensial yang terkonfigurasi:
  0 kecocokan. .env, data dan artefak berteks lengkap terkonfirmasi Git-ignored.
- npm run lint, npm run typecheck, npm run build: kedua workspace serta TypeScript
  tes browser lulus pada revisi akhir.
- PILOT_EXPECT_MODE=hybrid npm run test:pilot: 2 pass (desktop/mobile), masing-masing
  3 query anchor; respons benar-benar hybrid dan badge mode hybrid diperiksa.
  Arab/Indonesia dicocokkan dengan sumber, RTL, label riset dan copy/save/storage
  diuji. Screenshot desktop5971/mobile6116 ditinjau visual.
- npm run format:check: pemeriksaan format akhir seluruh target repository.

Root npm run dev ditinggalkan aktif: http://localhost:3000 dan
http://localhost:4000/api/v1/health, mode hybrid, dataScope local_pilot. Untuk
mematikan AI sementara, ubah APP_SEARCH_MODE=lexical dan restart API. Tidak ada
deployment. Detail hasil per query dan mode fallback tercantum dalam
G26_HYBRID_RESULTS.json; screenshot serta hasil berteks lengkap tetap Git-ignored.

Kegagalan yang diperbaiki: tes integrasi paralel pertama mendapat DB503;
payload kandidat dikurangi. Regresi fixture TEMP kemudian terdeteksi karena
skema minimal tidak memiliki kolom serializer. Jalur SQL diagnostik offline
dipisahkan dari proyeksi API, dan konsistensi skor SQL/TypeScript (termasuk
normalisasi panjang) diperiksa pada PostgreSQL nyata. Tidak menghapus assertion,
mengisi hadits buatan atau mengubah jawaban benchmark untuk membuat tes lulus.
Status G2.5/angka fixture historis tidak dievaluasi ulang sebagai bukti kualitas
corpus nyata. Kegagalan dan run sebelumnya tetap dijelaskan secara eksplisit.

## File berubah

- apps/api/src/providers/embedding/cloudflare-embedding.ts: telemetry numerik aman dan status HTTP internal untuk retry indexer.
- apps/api/src/database/index-embeddings.cli.ts: batch upsert, throttle/retry, report hasil dan resume/idempotensi.
- apps/api/src/modules/search/search.service.ts: lexical+embedding paralel, fallback tanpa deep scan bila index tidak tersedia, dan pengambilan halaman lexical setelah provider gagal pada page di luar kedalaman kandidat.
- apps/api/src/modules/hadiths/hadith.repository.ts, modules/search/search.repository.ts dan semantic.repository.ts: whitelist field serializer untuk mengurangi payload internal tanpa mengubah ranking.
- apps/api/src/modules/search/evaluation/pilot.cli.ts: benchmark 30, split, telemetry usage dan artefak terpisah.
- apps/api/src/modules/search/evaluation/fixtures.ts, evaluation/cli.ts dan relevance-ranker.ts: kompatibilitas diagnostik offline dan konsistensi formula skor, tanpa mengubah ranking API.
- apps/api/test/pilot.test.cjs, hybrid.integration.cjs; tests/pilot/hybrid-queries.json, local-pilot.spec.ts.
- apps/api/test/search-postgres.integration.cjs: verifikasi formula SQL/TypeScript pada TEMP regression.
- README.md, TASKS.md, decisions/ADR-006.md, docs/G26_REPORT.md, G26_HYBRID_REPORT.md dan G26_HYBRID_RESULTS.json.
- apps/api/.env lokal: mode hybrid; nilai kredensial tidak disalin ke source/dokumen.
