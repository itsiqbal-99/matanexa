# G3 — Lexical search dan evaluasi

Kelanjutan G2.6 memakai kamus id-lexical-v3, normalisasi indeks yang menjaga
dialog bersarang, bounded suffix normalization dan intent phrase yang dikurasi
sebagai aturan pencarian. SQL menormalkan sinyal primary/equivalent terhadap
panjang dokumen. Teks sumber tetap asli. Scope riset terpisah dari publik;
provider embedding/RRF/fallback tersedia, indeks semantic belum diisi. Bagian
G3 di bawah serta metrik fixture adalah catatan historis. Hasil corpus nyata,
kalibrasi sepuluh query dan batasnya ada di G26_REPORT dan ADR-006.

17 Oktober 2026. Implementasi hanya Next.js UI → NestJS → PostgreSQL remote.
Tidak ada LLM, embedding, vector retrieval atau layanan tambahan. Status korpus
nyata dan hasil eksekusi ada di G3_REPORT.md; metrik fixture bukan ukuran
relevansi hadits nyata.

## Pipeline dan batas modul

```text
SearchController
  → SearchService
      → MockRepository                         (mock, tanpa database)
      → QueryAnalyzer                          (lexical)
          → QueryNormalizer + SynonymService
      → SearchRepository + RelevanceRanker
          → DatabaseService → published_hadiths
  → serializeHadith → envelope data/meta
```

HadithRepository tetap menangani detail dan daftar sumber. SearchRepository
memiliki SQL retrieval/ranking/pagination; controller tidak mengandung SQL.
Semua komponen runtime memakai Nest DI. Folder evaluation hanya dipakai CLI
dan tes; tidak ada parameter HTTP untuk mengubah provider atau view publik.

## Input, normalisasi dan ambiguitas

DTO mempertahankan query asli. Batas transport 2400 karakter; sesudah NFKC,
control/whitespace normalization, query harus 3–300 codepoints. UI menyimpan
dan menampilkan pertanyaan asli. Teks sumber/terjemahan yang ditampilkan tidak
melewati normalisasi pencarian.

QueryNormalizer membuat salinan untuk pencarian: lowercase, NFKC, penanganan
spasi/tanda baca, lalu alias informal dan koreksi ejaan eksplisit. Contoh:

```text
Minta dong hadist soal jangan gampang MARAH!
→ minta dong hadits tentang jangan gampang marah
→ primaryTerms: gampang, marah
→ negations: jangan
→ topicSlugs: anger
```

Stopwords permintaan seperti dong/minta/tentang dihapus dari kata utama.
Negasi tidak/jangan/bukan/belum/tanpa/dilarang/larangan disimpan sebagai sinyal
tersendiri, tetap berada pada normalized query dan frasa. Alias nggak/gak/ga/
enggak/tak menjadi tidak; jgn menjadi jangan. Tidak ada stemming agresif atau
koreksi edit-distance untuk sembarang kata: `makam` tetap makam, bukan makan.
Koreksi seperti belajr→belajar, sedekha→sedekah dan mrah→marah ada pada kamus
yang dapat diaudit. Bahasa di luar aturan tersebut tidak dianggap dipahami.

Query tanpa anchor yang cukup, misalnya “Hadits tentang ini dong”, mempunyai
`meta.queryStatus=ambiguous`, hasil kosong, dan UI meminta topik/kata utama.
Query ambigu tetap mengakses PostgreSQL; kegagalan DB tetap 503. Pencarian
“bukan sedekah” mempertahankan negasi tetapi tidak menyimpulkan hukum atau
menganggap kalimat pengguna sebagai hadits yang sah.

## Kamus yang bisa dikembangkan

Edit search-vocabulary.ts; tidak perlu mengubah logika analyzer. Versi awal G3
adalah id-lexical-v2. Istilah terkait bersifat sinyal query, bukan klasifikasi
ilmiah terhadap hadits. Topic metadata pada database harus dikurasi manusia;
analyzer tidak menuliskan label tersebut ke record.

| Jenis                           | Contoh                                                  | Penggunaan                                                    |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| Ejaan/penggunaan setara         | infak/infaq; ucapan/perkataan; bicara/berbicara         | Sinyal equivalent, terpisah dari related                      |
| Setara dengan konteks orang tua | ayah/bapak/papa; ibu/bunda/mama; ortu/orang tua         | Tidak menyamakan ayah dengan ibu                              |
| knowledge                       | ilmu, berilmu, belajar, pengetahuan, pendidikan         | Perluasan terkait: menuntut/mencari ilmu, belajar, pendidikan |
| parents                         | orang tua, berbakti, birrul walidain, ibu, ayah         | Perluasan terkait: menghormati orang tua, berbakti            |
| anger                           | marah, amarah, emosi                                    | Menahan marah, pengendalian/mengendalikan emosi               |
| speech                          | lisan, ucapan, perkataan, berkata, bohong, ghibah       | Menjaga perkataan, berkata baik                               |
| charity                         | sedekah, bersedekah, infak, infaq, donasi, kedermawanan | Sedekah/berbagi rezeki sebagai terkait, bukan sinonim mutlak  |
| eating                          | makan, minum, santap, adab makan, tangan kanan          | Basmalah/bismillah hanya terkait dalam konteks makan          |

Kata memberi dan kanan sendiri tidak otomatis menjadi topik sedekah/makan.
Substring ibu dalam ibukota tidak cocok. Frasa ibu kota/ibu jari mengecualikan
cue ibu sebagai topik orang tua. Ini aturan terbatas, bukan disambiguasi umum.
Untuk query bertopik orang tua, label dokumen “ibu kota”/“ibu jari” juga
dikecualikan dari pencocokan kata/frasa, tanpa mengubah teks sumber. Frasa itu
tetap dapat dicari sebagai kata biasa pada query yang tidak bertopik orang tua.

## Retrieval, ranking dan indeks

SQL hanya membaca published_hadiths, yang mempertahankan syarat verified,
source approved, dan non-simulation. Migration 003 menambahkan topic_slugs
dari relasi yang dikurasi ke view; tidak mengubah 001/002 yang sudah terpasang.
Tidak ada approval sumber atau verifikasi record otomatis.

Kandidat diperoleh dari FTS simple, curated topic overlap, atau strict word
trigram pada anchor cukup panjang. Pencocokan kata/frasa menggunakan batas
kata. Kandidat yang hanya cocok pada related term lemah tidak cukup tanpa
anchor/equivalent/topik atau trigram kuat (>=0.72). Seluruh input SQL terikat
parameter, termasuk filter sumber, limit, offset, analisis dan bobot.

Skor lexical-signals-v1 merupakan penjumlahan sinyal terbatas:

| Sinyal          | Bobot balanced | Definisi                                                 |
| --------------- | -------------- | -------------------------------------------------------- |
| primary         | 12             | Proporsi kata utama yang cocok di teks/metadata          |
| phrase          | 8              | Sedikitnya satu frasa persis dengan batas kata           |
| equivalent      | 4              | Proporsi perluasan setara yang cocok                     |
| topic           | 4              | Topik query cocok dengan metadata yang dikurasi          |
| related         | 0.8            | Proporsi istilah terkait yang cocok                      |
| chapter         | 2              | Proporsi kata utama pada nama bab                        |
| fts             | 2              | ts_rank_cd dibatasi rank/(1+rank)                        |
| typo            | 1.5            | Strict word trigram similarity                           |
| negation        | 2              | Proporsi negasi query yang juga tertulis                 |
| negationMissing | -1             | Query bernegasi tetapi tidak ada negasi query yang cocok |

Negation alignment hanya sinyal redaksional, bukan logical inference. Derajat
hadits, otoritas penilai dan status izin tidak menjadi bobot relevansi. Status
publik adalah filter wajib; hasil tidak diberi persentase keyakinan palsu.
Skor dan fitur internal tidak dikirim ke frontend; serializeHadith memakai
daftar field publik yang eksplisit.

Urutan: score turun, source slug, collection ID, skema penomoran, nomor teks,
lalu ID. Deduplikasi memakai source+collection+scheme+number; terjemahan mirip
tidak menggabungkan record dari koleksi berbeda. Count, dedup dan pagination
berasal dari satu snapshot query. Page 1–10, limit 1–20; totalCandidates adalah
jumlah kandidat setelah filter/dedup, bukan klaim semua hadits relevan di dunia.

Indeks yang dipakai tetap GIN FTS simple, GIN pg_trgm untuk normalized_translation,
B-tree publikasi/koleksi, serta primary/reverse index pada topic relations.
Tidak menambah indeks tanpa kebutuhan data. Pengayaan topik melalui subquery
di satu SQL statement; tidak ada request N+1 dari aplikasi. Pool maksimum 3,
SQL timeout default 5 detik (CLI evaluasi 10 detik); koneksi/TLS diberi 10 detik
terpisah karena koneksi Neon yang diukur membutuhkan sekitar 6 detik.

Dokumentasi primer yang diperiksa: [PostgreSQL text search controls](https://www.postgresql.org/docs/current/textsearch-controls.html)
dan [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html). FTS memakai
simple; tidak mengasumsikan konfigurasi/stemmer Indonesian tersedia. Trigram
bersifat pencocokan ejaan, bukan pemahaman semantik.

## Evaluasi yang dapat diulang

Hentikan watcher API sebelum build karena menggunakan folder dist yang sama.
Dari root dengan Node LTS sesuai README:

```powershell
npm run build --workspace @matanexa/api
npm run db:check
npm run db:audit
npm run test:db
npm run search:evaluate
```

TEST_DATABASE_URL di apps/api/.env digunakan untuk evaluasi. CLI membuat tabel
TEMP, memakai SQL ranking yang sama pada relasi fixture khusus dan menutup
koneksinya. Tabel fixture hilang saat koneksi ditutup; tidak menulis corpus atau
mengganti view publik. Ini pengujian PostgreSQL nyata pada data simulasi.
CLI dan tes berbasis sesi memakai endpoint Neon langsung karena pooler transaksi
tidak mempertahankan TEMP/search_path. Migrasi yang sudah terpasang tidak diulang.

tests/fixtures/g3-search.json berisi 64 pertanyaan, enam topik, dan label fixture.
Generator menghasilkan 30 dokumen topik, dua pengecoh, dan satu duplikat untuk
uji ketahanan. Seluruhnya bertanda SIMULASI; tidak ada teks Arab, terjemahan
hadits, nomor atau derajat nyata. Expected fixture IDs merujuk record TEMP
yang memang dibuat; expectedHadithIdsVerified tetap null. Jawaban evaluasi
adalah label topik yang ditulis untuk fixture, belum ditinjau secara independen.
G2.5 menambahkan penilaian lengkap relevan/sebagian relevan/tidak relevan untuk
32 dokumen kanonik pada setiap query. Hanya label relevan dihitung dalam metrik
biner; sebagian relevan ditampilkan untuk inspeksi, tidak dihitung sebagai hit.
Jumlah gold relevan dapat kurang dari lima. Judgment ini hanya tentang label
simulasi, bukan penilaian ilmiah atau pengukuran relevansi matan hadits.

48 query dipakai untuk kalibrasi; 16 holdout. Ketiganya balanced/coverage/phrase
dibandingkan dengan merescore fitur SQL yang sama pada bagian kalibrasi;
latensinya bukan tiga benchmark terpisah. Pemilihan memakai MRR@10 lalu P@5,
tie mempertahankan profil lebih awal. Hasil terbatas ini tidak membuktikan
bobot optimal untuk korpus nyata. Holdout hanya pemeriksaan fixture tambahan,
bukan validasi eksternal atau label relevansi matan.

P@5, R@10, MRR@10 dan Hit Rate@5 dihitung sebagai macro-average pada 55 query
positif dengan relevance set lengkap khusus fixture. P@5 tetap membagi dengan 5. Sembilan query ambigu/no-result dilaporkan terpisah melalui noResultAccuracy;
zero-result rate mencakup seluruh 64 query. p50/p95 memakai nearest-rank.
Latensi adalah roundtrip SQL Neon, tidak mencakup HTTP/UI dan tidak menjadi
SLA produksi. Baseline G2 memakai algoritme lama pada fixture yang sama; satu
duplikat buatan adalah stress test yang biasanya dicegah UNIQUE pada database
aplikasi, sehingga selisih metrik tidak seluruhnya dapat digeneralisasi.

Output: docs/G3_BASELINE.json dan docs/G3_EVALUATION_CASES.json, termasuk
kategori, query/judgment, actual IDs, bobot, versi, hash input/corpus, split,
serta EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) pada tabel fixture. Korpus 33 row
terlalu kecil untuk membuktikan manfaat indeks atau performa pada skala besar.
Benchmark 30 query kit dan label hadith ID nyata tetap menunggu corpus berizin.
