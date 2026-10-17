# 02 — UI/UX Specification

## Arah desain
Terinspirasi kesederhanaan ChatGPT/Claude, **bukan menyalin logo atau UI persis**. Minimalist, warm-neutral, modern editorial SaaS, sophisticated typography dan motion ringan, menghindari gradient heboh dan ikon dekoratif berlebihan.

## Layout desktop
- Sidebar kiri 232–264px, dapat ditutup: Matanexa, New Chat, history lokal (max 20), Settings (dark/light dan tampil Arab default), tidak ada tombol login/notification palsu.
- Main centered content max-width sekitar 860–920px, header ringkas, percakapan dan komposer di bawah (sticky secara nyaman).
- Empty state: nama produk, 1 kalimat value proposition, composer tengah, 3 example prompts realistis; contoh topik **bukan** teks hadits.
- Message user bubble sederhana; assistant answer di halaman sebagai hasil retrieval, **bukan chat LLM**.
- Assistant result list menggunakan **compact readable cards**, bukan kartu besar penuh ikon. Satu item: judul bab/topik bila verified, collection + no, penggalan terjemahan yang memang berasal dari dataset, actions view/source/copy/bookmark; Arab full ditampilkan di detail.
- Filter chip 'Semua / Bukhari / Muslim / lainnya' sesuai data yang tersedia. Jangan hardcode pilihan yang tidak ada datanya.
- Dark/light; visual hierarchy dengan 8pt spacing, radius lembut, border hairline, hover/focus subtle.

## Mobile
- Sidebar sebagai drawer/hamburger dengan overlay dan close accessible.
- Composer tetap terlihat saat keyboard virtual, responsive button min 44px.
- Detail hadits sebagai bottom sheet / full screen modal scrollable; Arab RTL with adequate font, line-height 1.9–2.3.
- Tidak ada horizontal overflow, touch targets memadai.

## State design yang harus ada
1. `idle`: cara memakai dan quick prompts.
2. `loading`: placeholder skeleton dan status 'Sedang mencari ...', tanpa animasi berkepanjangan.
3. `results`: urutan hasil beserta metadata dan mode pencarian.
4. `empty`: tidak ditemukan pada korpus tersedia; suggest memperluas kata kunci.
5. `error`: internet/database tidak tersedia; coba lagi.
6. `aiFallback`: hanya kata kunci berjalan, tidak misleading.
7. `mock`: badge **'Pratinjau UI — data ilustrasi, bukan kutipan hadits'**.

## Detail drawer
Judul, referensi lengkap (collection, kitab, bab, number dan scheme), teks Arab utuh (jika data verified), terjemahan utuh, perawi jika verified, derajat **hanya dengan atribusi dan referensi penilai**, sumber link, copy citation; tombol source external memakai URL aktual. Jangan menciptakan hadith grade.

## Aksesibilitas/performance
HTML semantic, focus-visible, aria for icon-only controls, Enter submit dan Shift+Enter newline (bila textarea), Escape close modal, keyboard sidebar. Hindari layout shift; gunakan variable font lokal jika tersedia bebas lisensi dan tidak memberatkan. Hormati prefers-reduced-motion. Search history localStorage boleh dihapus.

## Acuan gambar
`assets/chat-ui-reference.png` hanya **reference layout moodboard**; tulisan contoh dan metadata pada gambar tidak menjadi referensi kebenaran teks hadits. Brand gunakan **Matanexa** bukan HaditsFinder.
