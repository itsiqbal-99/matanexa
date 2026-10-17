# 01 — Product Scope / PRD

## Masalah
Pengguna tidak hafal kata kunci atau nomor hadits. Mereka ingin mengetik bahasa Indonesia biasa, misalnya *'ada hadits tentang makan pakai tangan kanan?'*, lalu menemukan hadits yang relevan beserta sumber yang dapat ditelusuri.

## Persona dan janji produk
Pemula atau pengguna awam; tidak mengharuskan memahami transliterasi Arab, nama kitab atau terminologi fiqih. **Ini mesin pencari referensi, bukan mufti/chatbot generatif.**

## User journeys prioritas
1. Buka situs pertama kali -> lihat prompt composer besar, placeholder jelas dan 3 contoh pertanyaan -> submit.
2. Lihat daftar hasil yang terkait **dari database**, ringkasan UI dibuat dari data terverifikasi atau dihilangkan; nomor kitab, sumber, terjemahan, teks Arab.
3. Filter berdasarkan kitab/sumber, lihat detail yang berisi teks utuh, tautan referensi, status sumber.
4. Salin kutipan & referensi, bookmark lokal, riwayat pertanyaan lokal, chat baru.
5. Query baru menjadi sesi baru / pesan baru yang independen. Jangan gunakan respons generatif untuk konteks multi-turn.
6. Ketika tidak ada hasil -> beri 'Belum ditemukan', saran kata lain, bukan mengarang.

## MVP wajib
- UI conversational sederhana dengan sidebar collapsible, panel message, bottom sticky composer, responsive smartphone.
- Input teks bahasa Indonesia 3–300 karakter; search hanya saat submit; pembatalan request saat user submit query baru.
- API NestJS terpisah dengan `POST /api/v1/search`, `GET /api/v1/hadiths/:id`, `GET /api/v1/sources`, `GET /api/v1/health`.
- Filter kitab, toggle Arab/terjemahan, halaman/pagination result, source detail link.
- Teks Arab RTL jelas dan tanpa substitusi gaya transliterasi; terjemahan Indonesia dengan sumber.
- Riwayat/simpan via localStorage, tanpa login; tombol clear all.
- Mode mock/lexical/hybrid, graceful AI fallback, loading/empty/error.
- Metadata `citation`, numbering scheme, status verifikasi, grade attribution bila ada.

## Tidak masuk v1
- Login, profil, sinkronisasi, progress belajar, gamification, pembayaran, crawling terjadwal, OCR, voice, audio, PDF export.
- Menghasilkan fatwa, syarah, tafsir atau grade dengan LLM, menjawab soal agama tanpa hadits yang ditautkan.
- 'Semua hadits di dunia', ranking 99% akurasi tanpa pengukuran, full conversational memory multi-turn.
- Dashboard statistik, admin panel kompleks, real-time streaming, kolaborasi multiuser.
- Deployment production, domain, HTTPS, CI/CD production pada sprint lokal.

## Kriteria siap lokal
Semua tahapan G0–G5 di `TASKS.md`; hasil nyata hanya dengan corpus yang approved+verified dan metric pencarian dilaporkan transparan.

## Acceptance contoh
- User 'makan tangan kanan' -> hasil sesuai korpus verified+approved ketika memang tersedia; tak ada hadits palsu ketika tidak tersedia.
- User 'sebut nomor Bukhari 5376' -> jika ada dalam korpus, nomor/citation cocok; jika belum, nihil bukan improvisasi.
- Mode mock jelas label dummy; DB down => pesan error, bukan konten 'halusinasi'.
