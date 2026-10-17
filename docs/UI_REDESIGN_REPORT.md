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

| File                                            | Perubahan                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/web/app/globals.css`                      | Token visual, layout, motion, responsive, RTL detail dan reduced motion |
| `apps/web/app/layout.tsx`                       | Deskripsi metadata sesuai pratinjau pencarian lokal                     |
| `apps/web/features/search/search-workspace.tsx` | Shell, hero, prompt topik dan pengaturan                                |
| `apps/web/features/search/sidebar.tsx`          | Brand, navigasi, riwayat dan disclosure penyimpanan                     |
| `apps/web/features/search/composer.tsx`         | Composer baru dan disclosure status data                                |
| `apps/web/features/search/search-results.tsx`   | Presentasi query, loading dan posisi awal hasil                         |
| `apps/web/features/search/search-activity.tsx`  | Baru: animasi status dan lifecycle timer                                |
| `tests/e2e/chat.spec.ts`                        | Motion/preference/cancel regression, screenshot path baru               |
| `tests/e2e/database-contract.spec.ts`           | Screenshot path baru; kontrak tetap                                     |
| `playwright.config.ts`                          | Artefak regresi UI terpisah dari bukti G3                               |
| `.superdesign/design-system.md`                 | Dokumentasi desain terkini                                              |
| `docs/UI_REDESIGN_REPORT.md`                    | Laporan ini                                                             |
| `TASKS.md`                                      | Checklist khusus redesign setelah validasi                              |
| `README.md` | Tautan laporan dan lokasi bukti UI terbaru |

Tidak ada dependency baru, perubahan endpoint, retrieval, database, corpus,
embedding atau kredensial. Tidak ada deployment. Data pilot tetap dibatasi untuk
riset development, dengan label, pembatasan salin/simpan dan persistensi semula.

## Pengujian

Validasi akhir sedang berjalan. Hasil final dicatat setelah proses selesai.

Kegagalan yang ditemui selama validasi:

1. `npm run typecheck` dalam sandbox Windows gagal saat Next.js typegen:
   canonicalize `jsc.baseUrl`, Access is denied (os error 5). Perlu menjalankan
   compiler dengan izin proses yang sesuai.
2. Run pertama `npm test` gagal pada lima file suite karena sebagian modul pada
   `apps/api/dist` tidak ditemukan setelah penghentian watcher. Tidak ada perubahan
   kode API untuk mengatasinya. Build/tes ulang dilakukan secara berurutan dengan
   watcher berhenti; run ulang menghasilkan 26 pass, 0 fail.

## Bukti visual

Screenshot lokal pada `artifacts/ui-redesign/` (diabaikan Git): baseline,
desktop/mobile terang/gelap, searching, hasil dan detail. Screenshot corpus riset
tetap lokal dan tidak dimasukkan ke layanan desain eksternal.

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
