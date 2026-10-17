# Audit sumber dataset — G2.5

17 Oktober 2026. Audit bukti publik, bukan persetujuan hukum atau verifikasi
ilmiah per hadits. **Empat kandidat pending_review; approved 0; corpus nyata
diunduh/diimpor/dipublikasikan 0.** Bukti database: G25_DATABASE_AUDIT.json.

## Kandidat dan bukti

| Kandidat                                                              | Asal, teks dan format                                                                                                                                                                                            | Metadata dan integritas                                                                                                                                                                                                                                                              | Software vs hak konten; keputusan                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [gadingnst/hadith-api](https://github.com/gadingnst/hadith-api)       | README menunjuk tafsirq.com; sembilan koleksi, Arab dan Indonesia, REST JSON.                                                                                                                                    | Lookup kitab/range/nomor tersedia. Edisi, penerjemah, skema nomor, bab, atribusi grade dan kelengkapan per record belum dibuktikan. Total corpus tidak dihitung oleh proyek.                                                                                                         | [LICENSE](https://github.com/gadingnst/hadith-api/blob/master/LICENSE) MIT untuk software; belum ditemukan bukti hak upstream atas terjemahan Indonesia untuk redistribusi Matanexa. **pending_review**.                                |
| [renomureza/hadis-api-id](https://github.com/renomureza/hadis-api-id) | README menyebut sembilan koleksi dan data dari hadith-api/tafsirq.com dengan perbaikan; JSON REST dengan pagination.                                                                                             | Kitab/nomor lookup ada. Bukan sumber independen dari kandidat pertama. Kelengkapan Arab/Indonesia, bab, derajat beratribusi, edisi dan korespondensi nomor belum diperiksa per record.                                                                                               | README menyatakan MIT, tetapi rantai izin terjemahan upstream belum terbukti. Link folder data bukan bukti lisensi/integritas. **pending_review**.                                                                                      |
| [hapibi/hadith-json](https://github.com/hapibi/hadith-json)           | Gabungan AhmedBaset, muallimai, fawaz, sagad; asal utama Sunnah.com dan sumber tambahan. Unified JSON menyediakan Arab/terjemahan, kitab, chapterId, idInBook, grade+penilai, reference URL dan flag kekosongan. | README melaporkan perbaikan salah pasangan akibat join posisi/penomoran. Locale Indonesia sagad masih draft; beberapa koleksi tidak mempunyai terjemahan Indonesia. Skema lengkap tidak membuktikan pasangan setiap record benar. Jangan gunakan indeks baris sebagai nomor rujukan. | Bagian attribution meminta mengikuti lisensi upstream; belum ada bukti menyeluruh hak terjemahan Indonesia. Lisensi software/komponen tidak menyelesaikan hak konten gabungan. **pending_review**, perlu audit edisi dan pasangan teks. |
| [Sunnah.com developers](https://beta.sunnah.com/developers)           | Halaman resmi menawarkan sebagian data lewat API, ditambah setelah pemeriksaan manual; API key diperlukan, dump offline disebut belum tersedia.                                                                  | Kandidat rujukan independen untuk dataset lain. Arab/Indonesia, bab, nomor edisi dan grade per record belum diperiksa lewat API karena key belum tersedia.                                                                                                                           | Hak akses API tidak otomatis memberi hak redistribusi konten. Ketentuan penggunaan terjemahan Indonesia untuk proyek belum dibuktikan. **pending_review**.                                                                              |

Bukti README primer: [gadingnst](https://raw.githubusercontent.com/gadingnst/hadith-api/master/README.md),
[renomureza](https://raw.githubusercontent.com/renomureza/hadis-api-id/main/README.md).
Rincian hapibi berasal dari bagian Provenance, Known limitations, schema dan
Attribution & license pada README tertaut; klaim perbaikan upstream belum
diaudit ulang oleh Matanexa. Angka total/match rate upstream tidak dipakai
sebagai hasil verifikasi kita.

Tool gagal mengambil raw README/SOURCE_REGISTRY hapibi dan beberapa link file
GitHub (cache miss/internal error). README halaman utama berhasil dibaca.
Tidak menebak isi file yang gagal diakses atau menganggap audit per record selesai.

## Tiga status yang dipisahkan

| Dimensi                                      | Status saat ini                      | Syarat berikutnya                                                                                    |
| -------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Legalitas untuk penggunaan yang direncanakan | Belum ada sumber approved            | Bukti dari pemilik hak mencakup Arab, terjemahan Indonesia, atribusi dan redistribusi                |
| Integritas dataset                           | Belum ada pilot nyata yang diperiksa | Versi/hash tetap, pasangan Arab–Indonesia, skema nomor, duplikasi, missing fields, rujukan dan edisi |
| Verifikasi ilmiah hadits                     | Belum dilakukan; verified nyata 0    | Pemeriksa manusia, tanggal dan rujukan per record; grade hanya dengan penilai dan sumber             |

Pending_review berarti bukti proyek belum cukup, bukan tuduhan pelanggaran.
MIT repository tidak diasumsikan melisensikan ulang terjemahan pihak lain.
Izin sumber tidak otomatis memverifikasi redaksi atau derajat sebuah hadits.

## Pilihan G2.5

Pilot 100–300 nyata **blocked_before_acquisition**. Tidak ada bulk download,
scraping, permintaan key/izin atau issue yang dikirim atas nama pengguna.
Sesuai fallback eksplisit instruksi G2.5, pilih fixture label topik buatan
sendiri di tests/fixtures/g3-search.json. Tidak mengandung matan, terjemahan,
nomor autentik atau grade. Semua record dan ID bertanda SIMULASI/SIM-;
hanya masuk tabel TEMP evaluasi dan schema test terisolasi, tidak ke jalur publik.

Fixture menyediakan enam topik teknis yang sudah didukung kamus G3, bukan
pengganti cakupan sepuluh topik pilot nyata. Kejujuran, akhlak, kebersihan dan
kasih sayang membutuhkan corpus/kurasi nyata berikutnya. Tidak menambah label
agama buatan untuk memenuhi angka target.

## Rencana pilot setelah bukti tersedia

1. Catat pemilik hak/penerjemah, izin dan batas redistribusi, URL bukti,
   versi/edisi/hash file dan sistem penomoran. Persetujuan manusia atas sumber.
2. Pilih 100–300 record dari topik target yang memang tersedia; pertahankan teks
   dan nomor string asli, rujukan serta provenance. Tidak menambal field kosong.
3. Jalankan dry-run, periksa duplikasi/missing fields. Lakukan cross-check
   sampel terhadap rujukan independen dan cocokkan setiap record sebelum verified.
   Catat mismatch, edisi/nomor alternatif dan pemeriksa. Grade boleh kosong.
4. Import draft, verifikasi manusia, lalu evaluasi dengan actual database IDs
   dan qrels independen. Baris pending/draft/simulasi tidak boleh dipublikasikan.

Cross-check nyata pada snapshot G2.5: **0 sampel, mismatch/missing/nomor tidak konsisten
N/A**, karena tidak ada corpus yang lolos izin untuk pilot. Bukan laporan
“0 mismatch” atau bukti kualitas sempurna. Lihat G25_DATA_QUALITY.json dan G25_REPORT.md.

## Kelanjutan G2.6 — Fawaz Bukhari, research_only

Sumber primer: https://github.com/fawazahmed0/hadith-api. Revisi tetap
`df57907be35291c91ad6a6691180e22ca9920784`, edisi ind-bukhari + ara-bukhari.
Lisensi repository tidak dianggap menyelesaikan hak terjemahan upstream.
Pengguna mengizinkan pilot riset localhost secara eksplisit; status sumber
research_only, bukan approved. Data publik tetap 0.

417 identitas dipilih dari makanan/adab dan sampel wahyu/ilmu/zakat. Pairing
berdasarkan nomor string, koleksi dan reference kitab/hadits serta arabicnumber,
bukan urutan array. 13 kosong/invalid ditolak; 404 pasangan diterima. Semua
teks disimpan verbatim, grade tidak diimpor. Hash, edisi, URL pinned dan status
pairing/humanReview tersimpan per raw_record. Pairing metadata tidak membuktikan
kesamaan redaksi terhadap edisi cetak atau verifikasi ilmiah seluruh corpus.

Rujukan pembanding tiga anchor: https://sunnah.com/bukhari:5376,
https://sunnah.com/bukhari:5971, https://sunnah.com/bukhari:6116. Ini tidak
dianggap tinjauan manusia independen 404 baris. Repository superXdev/hadits-api
hanya ditinjau sebagai pembanding provenance/penomoran; databasenya tidak
dipakai. Tidak melakukan scraping hadits.in. Corpus lengkap dan artefak teks
berada di direktori Git-ignored; rincian hasil ada di G26_REPORT.
