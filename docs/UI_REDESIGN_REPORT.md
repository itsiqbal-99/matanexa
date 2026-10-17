# Matanexa — UI redesign

Tanggal: 17 Oktober 2026. Scope: redesign frontend localhost atas instruksi
terbaru pengguna. Pekerjaan quality/performance hardening G4 belum selesai dan
tidak dinyatakan lulus oleh laporan ini.

## Perubahan

- Palet midnight navy, cobalt dan icy cyan menggantikan cream/green; sans sistem,
  sidebar baru, breadcrumb, kartu topik, hero, composer, hasil dan dialog detail.
- Tema terang/gelap, drawer mobile, composer tetap tersedia di bawah workspace,
  layout responsif, focus ring, native dialog, Escape dan pengembalian fokus.
- Motion masuk halaman, hover, sidebar collapse, drawer/dialog dan stagger hasil.
  Status pencarian memakai typing, search ring, dots dan skeleton pulse.
- Typing hanya untuk teks antarmuka tetap. Tidak ada jawaban generatif, perubahan
  kutipan sumber, persentase progres palsu atau penundaan hasil buatan.
- Reduced motion mematikan animasi dan typing, termasuk perubahan preferensi
  ketika request berjalan. Timer dilepas ketika komponen di-unmount/dibatalkan.
- Sidebar desktop yang ditutup bersifat inert sehingga tidak mengambil fokus.
- Posisi scroll menampilkan awal hasil, bukan otomatis melompat ke bagian akhir.
- Disclosure awal tidak lagi menyebut seluruh aplikasi selalu memakai mock.

## File yang dibuat/diubah

| File                                            | Perubahan                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/app/globals.css`                      | Token visual, layout, motion, responsive, RTL detail dan reduced motion           |
| `apps/web/app/layout.tsx`                       | Deskripsi metadata sesuai pratinjau pencarian lokal                               |
| `apps/web/features/search/search-workspace.tsx` | Shell, hero, prompt topik dan pengaturan                                          |
| `apps/web/features/search/sidebar.tsx`          | Brand, navigasi, riwayat dan disclosure penyimpanan                               |
| `apps/web/features/search/composer.tsx`         | Composer baru dan disclosure status data                                          |
| `apps/web/features/search/search-results.tsx`   | Presentasi query, loading dan posisi awal hasil                                   |
| `apps/web/features/search/search-activity.tsx`  | Baru: animasi status dan lifecycle timer                                          |
| `tests/e2e/chat.spec.ts`                        | Motion/preference/cancel regression, screenshot path baru                         |
| `tests/e2e/database-contract.spec.ts`           | Screenshot path baru dan regresi posisi dialog desktop/mobile; kontrak data tetap |
| `playwright.config.ts`                          | Artefak regresi UI terpisah dari bukti G3                                         |
| `.superdesign/design-system.md`                 | Dokumentasi desain terkini                                                        |
| `docs/UI_REDESIGN_REPORT.md`                    | Laporan ini                                                                       |
| `TASKS.md`                                      | Checklist khusus redesign setelah validasi                                        |
| `README.md`                                     | Tautan laporan dan lokasi bukti UI terbaru                                        |

Tidak ada dependency baru, perubahan endpoint, retrieval, database, corpus,
embedding atau kredensial. Tidak ada deployment. Data pilot tetap dibatasi untuk
riset development, dengan label, pembatasan salin/simpan dan persistensi semula.

## Pengujian

Runtime: Node 24.22.0 dan npm 11.19.1, Windows, Next.js 16.4.2, Microsoft Edge
headless. Semua perintah dijalankan dari root dengan Node portable di `.tools/`
pada PATH. Tidak ada package baru yang diunduh untuk implementasi.

| Perintah                                                                                                               | Hasil                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                                         | Exit 0 untuk API dan web                                                                              |
| `npm run lint --workspace @matanexa/web`                                                                               | Exit 0 pada revisi UI final                                                                           |
| `npm run typecheck`                                                                                                    | Exit 0 untuk API, Next.js typegen/TypeScript dan suite browser                                        |
| `npm test`                                                                                                             | 26 pass, 0 fail setelah build ulang                                                                   |
| `npm run build`                                                                                                        | Exit 0, NestJS dan production build Next.js berhasil; route `/` statis                                |
| `npm run build --workspace @matanexa/web`                                                                              | Exit 0 setelah koreksi CSS dialog; `npm run typecheck` juga kembali exit 0                            |
| `npm run test:e2e`                                                                                                     | 20 pass, 0 fail; run revisi akhir 118,216 detik                                                       |
| `node node_modules/@playwright/test/cli.js test --grep 'loading, cancel\|animated search status' --reporter=list,json` | Pemeriksaan ulang terakhir: 4 pass, 0 fail, 66,924 detik                                              |
| `npm run test:pilot` dengan `$env:PILOT_EXPECT_MODE='hybrid'`                                                          | 2 pass, 0 fail, 48,298 detik; 3 anchor pada masing-masing viewport                                    |
| `node node_modules/@playwright/test/cli.js test --grep 'lexical contract fixture' --reporter=list,json`                | 2 pass, 0 fail, 26,0 detik setelah koreksi dialog; posisi tengah desktop dan lebar 390px mobile diuji |
| `npm run format:check` dan Prettier dokumen desain                                                                     | Root exit 0; laporan, checklist dan dokumen desain diperiksa terpisah pada akhir pekerjaan            |

Regresi browser mencakup welcome, 360px/390px/1440px, terang/gelap dan persistensi
preferensi, sidebar/drawer, input/keyboard, pencarian NestJS mock, filter,
detail/focus trap/Escape, salin/simpan, riwayat/hapus, empty, aborted, retry,
network failure, payload invalid, timeout, storage rusak/tidak tersedia, fixture
RTL/provenance dan penolakan metadata/URL yang tidak aman. Tes baru memeriksa
pertambahan karakter status, animasi ring, perubahan reduced motion secara langsung
dan hilangnya status setelah pembatalan. Tidak ada error JavaScript pada halaman.

Sesudah dua revisi kecil terakhir (status live tidak berada di bawah ancestor
`aria-busy`, dan label navigasi LOKAL), empat skenario loading/motion diperiksa
ulang; build, typecheck dan lint web juga dijalankan lagi.

Pemeriksaan layout tambahan lewat Playwright pada lebar 360, 390, 768, 820,
1024, 1440 dan 1920px: tidak ada overflow horizontal, composer berada di viewport,
0 error JavaScript. Ringkasan aman: `artifacts/ui-redesign/layout-audit.json`.

Pilot nyata menguji tiga pertanyaan untuk Bukhari 5376 (makan dengan tangan
kanan), 6116 (menahan amarah), 5971 (mendahulukan ibu). Keenam respons pencarian
harus benar-benar `hybrid` karena `PILOT_EXPECT_MODE` aktif. Tiap viewport
memeriksa anchor pada top5, teks Arab/Indonesia asli, RTL, status grade belum
tersedia, pembatasan salin/simpan dan ketiadaan corpus dalam localStorage.
Ringkasan: `artifacts/ui-redesign/pilot-summary.json`. Durasi pada tabel adalah
durasi suite browser, bukan benchmark latency API atau penilaian relevansi G4.

Pemeriksaan visual menemukan dialog desktop awal belum berada di tengah karena
reset margin. CSS `margin: auto` diperbaiki, lalu tes posisi desktop/mobile
ditambahkan dan dua skenario kontrak dijalankan lagi. Screenshot fixture terbaru
menunjukkan dialog di tengah. Teks sumber dan jalur pencarian tidak berubah.

Kegagalan yang ditemui selama validasi:

1. `npm run typecheck` dalam sandbox Windows gagal saat Next.js typegen:
   canonicalize `jsc.baseUrl`, Access is denied (os error 5). Perlu menjalankan
   compiler dengan izin proses yang sesuai.
2. Run pertama `npm test` gagal pada lima file suite karena sebagian modul pada
   `apps/api/dist` tidak ditemukan setelah penghentian watcher. Tidak ada perubahan
   kode API untuk mengatasinya. Build/tes ulang dilakukan secara berurutan dengan
   watcher berhenti; run ulang menghasilkan 26 pass, 0 fail.
3. Satu start `npm run dev` gagal `EADDRINUSE` karena server lain sedang memakai
   port 3000. Proses Matanexa pemilik port diperiksa dan dihentikan sementara untuk
   regresi mock. Server akhir memakai kembali konfigurasi `.env` hybrid lokal.
4. Prettier pertama pada draft laporan memberi peringatan format; draft diformat
   ulang sebelum pemeriksaan akhir.

## Bukti visual

Screenshot lokal pada `artifacts/ui-redesign/` (diabaikan Git): baseline,
desktop/mobile terang/gelap, searching, hasil dan detail. Screenshot corpus riset
tetap lokal dan tidak dimasukkan ke layanan desain eksternal.

Artefak utama:

- `desktop-light.png`, `desktop-dark.png`, `mobile-light.png`, `mobile-dark.png`,
  `mobile-drawer.png`: tampilan baru; screenshot mobile final memakai touch emulation.
- `desktop-searching.png`, `mobile-searching.png`: status typing/searching.
- `regression-desktop-contract-fixture.png`: dialog desktop yang sudah di tengah;
  fixture eksplisit, bukan kutipan hadits nyata.
- `pilot-desktop-results.png`, `pilot-desktop-detail.png`, `final-demo.json`:
  pemeriksaan tambahan satu query 5376 setelah koreksi dialog; HTTP 200, hybrid,
  local_pilot, dialog terkonfirmasi di tengah. Tidak mengubah corpus.
- `e2e-results.json`, `motion-final-results.json`, `dialog-final-results.json`,
  `pilot-summary.json`, `layout-audit.json`, `format-check.log`: bukti pengujian.

## Kriteria hasil

- Lulus: redesign visual/motion, tema, layout dan navigasi, loading/error/empty/
  abort, dialog/fokus, regresi mock dan hybrid nyata pada localhost.
- Lulus: teks hadits/terjemahan tidak dibuat ulang; tidak ada endpoint, retrieval,
  schema database atau pembatasan pilot yang diubah.
- Lulus: lint/typecheck/tes/build, dengan kegagalan awal dan perbaikannya dicatat.
- Belum dinyatakan lulus: hardening relevansi/performa G4, hak publikasi corpus,
  review manusia independen dan sign-off G5.

## Batas verifikasi

Pengujian browser menggunakan Microsoft Edge headless di Windows, bukan klaim
pengujian Safari/Firefox/perangkat fisik atau audit WCAG independen. Bahasa
antarmuka tetap pencarian referensi dan tidak menjamin relevansi atau hukum agama.

Preflight Superdesign `npx --yes @superdesign/cli@latest` ditolak oleh pemeriksaan
persetujuan otomatis karena mengunduh dan mengeksekusi paket pihak ketiga yang
tidak dipatok versinya. Tidak dicoba workaround. Desain diimplementasikan langsung
di repository memakai React, CSS dan Lucide yang sudah terpasang.

G4 hardening, izin publikasi corpus, tinjauan manusia independen dan sign-off G5
tetap pekerjaan terpisah yang belum dinyatakan selesai.
