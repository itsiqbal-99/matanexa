# Database development G2

Status terkini G2.6: migrasi 004 menambah status research_only dan view lokal
terpisah; 005 menambah pgvector 1024 dimensi. Ada 404 draft riset, 0 publik,
0 approved. Instruksi historis G2/G3 berikut tetap berlaku bagi mode published.
Perintah pilot/reindex dan scope development ada di README serta G26_REPORT.
Hybrid kini tersedia dengan fallback, tetapi indeks semantic nyata belum diisi.

Kelanjutan G3: migration 003_curated_topics.sql menambahkan topic_slugs pada
view publik; tidak mengubah filter publik atau migration 001/002. SearchRepository
G3 memakai beberapa sinyal dan kamus versi id-lexical-v2. Bagian lexical G2 di
bawah merupakan dasar historis; perilaku terbaru dan evaluasi ada di
[SEARCH_ENGINE.md](SEARCH_ENGINE.md) dan [G3_REPORT.md](G3_REPORT.md).

Backend memakai `pg`, PostgreSQL remote Neon dan TLS dengan verifikasi sertifikat.
Tidak ada PostgreSQL lokal, Docker atau model AI. Mock tidak membuat pool DB.
`GET /health` merupakan liveness/configuration; `databaseConfigured` bukan bukti
database dapat diakses. `npm run db:check` benar-benar menjalankan `SELECT 1`.

## Setup dan perintah

Simpan kredensial sendiri di `apps/api/.env` yang diabaikan Git. Jangan menimpa
file tersebut dengan contoh bila sudah berisi kredensial. Gunakan project/branch
Neon development khusus, bukan database produksi atau database aplikasi lain.
Host koneksi harus `.neon.tech`. URL standar `sslmode=require`/`verify-full` dan
`channel_binding=require` diterima; opsi SSL URL dibuang agar tidak menimpa
`rejectUnauthorized: true`. Pool maksimum 3; default timeout SQL 5 detik.

```dotenv
APP_SEARCH_MODE=mock
DATABASE_URL=
DB_POOL_MAX=3
DB_TIMEOUT_MS=5000
# Hanya untuk suite integrasi pada branch test yang terpisah:
TEST_DATABASE_URL=
```

Dari root dengan Node LTS yang dijelaskan README, hentikan watcher API sebelum
build karena keduanya memakai `dist` yang sama:

```powershell
npm run build --workspace @matanexa/api
npm run db:check
npm run db:migrate
npm run db:import -- "D:\data\dataset-berizin.json"
npm run test:db
```

Setelah migrasi dan tersedianya corpus berizin/diperiksa, ubah mode menjadi
`lexical`, restart API, lalu jalankan web seperti biasa. Jika corpus belum ada,
respons lexical kosong merupakan hasil yang sah. DB mati/tabel belum tersedia
menghasilkan 503 `DATABASE_UNAVAILABLE`, tanpa fallback mock. Hybrid belum aktif.
Untuk tetap bekerja offline setelah install dependency, gunakan mode mock.

## Schema final G2

`db/001_schema.sql` dan `002_search_examples.sql` adalah desain historis kit;
**jangan dieksekusi sebagai migration**. Sumber executable hanya `db/migrations/`:

| Migration              | Isi                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 001_foundation.sql     | source_catalog, hadith_collections, import_runs, hadiths, hadith_topics, hadith_topic_relations, constraint, trigger dan view publik |
| 002_search_indexes.sql | pg_trgm, generated FTS simple, GIN/index relasi dan penambahan search_document ke view                                               |

Runner membuat `schema_migrations(name,checksum,applied_at)` serta advisory lock;
seluruh migration yang belum diterapkan dijalankan dalam satu transaksi.
Checksum drift, file migration yang hilang dan versi tersisip sebelum versi
terpasang ditolak. Tidak auto-migrate saat startup. Tidak membuat vector,
embedding, vector index atau tabel grading terpisah: satu penilaian opsional per
record beserta penilai/URL cukup sampai data nyata menunjukkan kebutuhan lain.

Identitas record: `(source_id,collection_id,numbering_scheme,hadith_number)`.
Nomor berupa teks; edisi dan sumber berbeda tidak dianggap identik.
`source_catalog.permission_status`: candidate/approved/rejected. Kandidat
audit pending_review dipetakan ke candidate jika nanti dicatat dalam database.
Approval membutuhkan lisensi, bukti izin, atribusi, catatan dan waktu pemeriksaan.
`hadiths.verification_status`: draft/review/verified/rejected, terpisah dari izin.
Verified membutuhkan pemeriksa, tanggal, bukti rujukan dan bukan simulasi.
Ketiganya dibatasi view `published_hadiths` yang dipakai search, sources, detail.
Sumber dicabut => semua recordnya langsung tersembunyi. Koreksi teks/rujukan/
grade/identitas melalui UPDATE membatalkan verifikasi via trigger.

## Format import dan workflow

Pipeline tidak mengunduh URL, tidak menyetujui lisensi, tidak memverifikasi
hadits dan tidak menerima field status dari input. Operator harus mencatat
bukti sumber dan mendapat persetujuan manusia terlebih dahulu. Input JSON:

```text
{
  sourceSlug, datasetVersion, datasetUrl,
  records: [{
    collection: {slug, name, originalName?},
    hadithNumber, numberingScheme, bookName, chapterName?, narrator?,
    arabicText, indonesianText, translationAttribution, referenceUrl,
    grade?: {text, grader, sourceUrl}
  }]
}
```

Ini deskripsi field, bukan dataset siap import. Maksimum file 10MB, 10.000
record, field teks 50.000 karakter. Teks asli tidak di-trim/ditulis ulang;
normalisasi NFKC/lowercase/control/whitespace hanya ke normalized_translation.
Raw record, hash konten, run import, versi/URL dataset dan hash file disimpan.
Perubahan metadata koleksi yang sudah ada ditolak, bukan menimpa metadata.
Setiap record valid baru masuk draft. Import ulang hash sama => skipped;
perubahan isi => updated dan draft lagi; duplikasi identitas sama/isi sama
dalam file => duplicated; konflik isi dalam file => failed. Savepoint menjaga
record gagal tidak merusak record lain. Source lock menserialisasi import sumber
yang sama. Laporan berisi imported/updated/skipped/duplicated/failed dan indeks
record gagal tanpa membocorkan teks/kredensial. Laporan disimpan di import_runs
dan stdout; command exit 1 bila ada failed, walaupun record valid telah commit.

Sesudah import, pemeriksa manusia mencocokkan setiap teks, rujukan, nomor,
edisi dan atribusi sebelum perubahan status lewat administrasi database.
Tidak ada endpoint publik atau flag untuk bypass. Jangan memasukkan contoh
SIMULASI sebagai record verified. Test-only fixture tidak boleh menjadi corpus.

## Lexical G2 historis (digantikan G3)

Kamus editorial `id-search-v1` ada di lexical-query.ts. Kata permintaan umum
dibuang, kelompok sinonim statis diperluas; contoh “Kasih hadits tentang menuntut
ilmu” menjadi `ilmu | belajar | pengetahuan | pendidikan`. Ini input tsquery
terikat parameter, bukan SQL interpolasi. FTS `simple` memakai normalisasi
Indonesia, judul/bab; trigram mendukung kecocokan tambahan. Ranking ts_rank_cd,
similarity, lalu tie-break stabil sumber/skema/nomor/id. Semua kandidat hanya
dari view publik. Pagination limit 20, page maksimal 10; hasMore false pada page 10. Total seluruh kandidat tetap diperoleh walaupun halaman kosong.

Tidak ada stemming Indonesia bawaan, pemahaman konteks, atau janji semantic
search. OR sinonim dapat memperluas hasil terlalu jauh; stopword dapat membuang
kata bermakna pada pertanyaan tertentu. Pencarian Arab langsung belum diindeks
G2. Kualitas ranking nyata dan benchmark tidak dapat dinilai tanpa corpus
terverifikasi. Query non-keyword tetap mengakses DB sehingga kegagalan DB
tidak tertutup respons kosong.

## Pengujian dan recovery

`npm test` memakai client/repository doubles untuk SQL protocol dan HTTP asli
Nest. Ini tidak membuktikan sintaks/constraint PostgreSQL telah berjalan.
`npm run test:db` hanya menggunakan TEST_DATABASE_URL dan skip eksplisit bila
kosong. Pada branch test, suite membuat schema acak `matanexa_g2_test_<hex>`,
menguji migrasi dua kali, import draft/idempotency, filter publik, injection,
constraint simulasi dan ranking FTS pada VALUES placeholder terpisah. Schema
test dibuang setelah tes; extension pg_trgm di schema public dapat tetap ada.
Tidak mempublikasikan fixture verified. Jalankan hanya pada branch test khusus.

Migrasi gagal => transaksi ROLLBACK; perbaiki sebabnya, jalankan ulang. Migration
yang sudah terpasang tidak diedit; tambahkan versi perbaikan. Untuk recovery
konten, hentikan import, simpan laporan/hashes dan raw sumber, gunakan backup/
branch recovery Neon yang tersedia atau salinan berizin, lalu verifikasi ulang.
Tidak menyediakan down migration yang menghapus corpus. Salah sumber segera
ubah permission_status menjadi candidate/rejected sebelum koreksi.
Jangan melakukan destructive reset atau mencetak URL koneksi saat diagnosis.

## G2.5 — audit dan dry-run

`npm run db:audit` membaca jumlah record, riwayat migrasi dan struktur kolom,
menulis `docs/G25_DATABASE_AUDIT.json` tanpa credentials atau teks hadits.
Tidak menjalankan ulang migrasi. Build API dahulu jika source CLI berubah.

Untuk file dataset berizin yang telah disiapkan, dari root:

```powershell
npm run db:import -- C:\data\approved-pilot.json --dry-run
```

Path di atas contoh lokasi, bukan file bawaan. Dry-run tetap mensyaratkan
sumber approved dan menjalankan schema validation, savepoint dan upsert yang sama,
tetapi berakhir ROLLBACK. Angka imported/updated/skipped adalah rencana tindakan,
bukan record yang tersimpan; `dryRun=true`, `committed=false`, runId tidak persisten.
Field invalid dilaporkan melalui path field tanpa isi teks. Exit 1 bila ada
record gagal. Hilangkan `--dry-run` hanya saat dataset siap diimpor sebagai draft.
Tidak ada flag untuk menyetujui sumber atau memverifikasi record secara otomatis.

Pengujian berbasis sesi dan evaluasi TEMP memakai koneksi Neon langsung,
diturunkan dari hostname pooler yang tervalidasi dengan menghapus akhiran
`-pooler` pada label endpoint. TLS dan credentials tetap sama dan tidak dicetak.
Runtime API tetap memakai pool kecil; migrasi/import menggunakan transaksi.
Alasannya: [Neon transaction pooling](https://neon.com/docs/connect/connection-pooling)
tidak mempertahankan TEMP/search_path antartransaksi. Tidak membuat database baru.
