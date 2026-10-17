# @matanexa/web

Next.js App Router + React + TypeScript strict + Tailwind CSS (PostCSS).
G1 menyediakan UI chat yang memanggil NestJS lewat API client terpusat. UI tidak
melakukan matching pencarian, akses database, Next API routes atau Server Actions.
Hasil mock adalah simulasi dengan field agama null. Payload lexical tervalidasi
ditampilkan pada kartu/detail yang sama: nomor+skema, Arab RTL, terjemahan+
atribusi, provenance, tautan HTTPS aman dan grade hanya beserta penilai/rujukan.
Tidak ada corpus nyata yang telah disetujui pada audit G2; QA lexical memakai
fixture respons bertanda SIMULASI, bukan bukti kualitas data hadits.

Dari root: `npm run dev --workspace @matanexa/web` (port 3000), atau
`npm run dev` untuk kedua aplikasi. Salin `.env.local.example` ke `.env.local`.
`NEXT_PUBLIC_API_BASE_URL` hanya URL publik NestJS, bukan kredensial.

`npm run lint --workspace @matanexa/web`, `npm run typecheck --workspace
@matanexa/web`, dan `npm run build --workspace @matanexa/web` memverifikasi setup.
`npm run start --workspace @matanexa/web` menjalankan hasil build secara lokal.
Font sistem dipakai agar build tidak bergantung unduhan font.

Fitur: contoh pertanyaan, composer auto-resize/Enter/Shift+Enter, loading/batal,
retry/timeout/empty, filter koleksi di API, dialog detail, salin berlabel simulasi,
bookmark, riwayat maksimal 20, dark/light, drawer mobile, dan hapus data lokal.
localStorage memakai key `matanexa.workspace.v1`; data divalidasi sebelum dibaca.
Setiap query adalah entri riwayat independen, bukan konteks multi-turn.

Tes UI root: `npm run test:e2e` sesudah kedua server siap. Lihat laporan G1 dan
screenshot desktop/mobile di `docs/`.

G3 menampilkan permintaan klarifikasi untuk respons lexical dengan
meta.queryStatus=ambiguous dan mempertahankan ejaan pertanyaan asli.
Normalisasi, sinonim dan perankingan tetap sepenuhnya di NestJS/PostgreSQL.
