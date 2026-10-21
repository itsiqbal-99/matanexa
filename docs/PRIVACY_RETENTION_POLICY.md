# Matanexa vNext — Privacy, Retention, and Provider Data Policy

Status: berlaku untuk Phase 1 dan menjadi minimum policy untuk fase vNext
berikutnya. Perubahan yang memperluas penyimpanan atau pengiriman data memerlukan
review dan keputusan baru.

## Prinsip

- Minimalkan data: kirim dan simpan hanya field yang diperlukan untuk fungsi yang
  sedang aktif.
- Secret dan token selalu backend-only; tidak ada `NEXT_PUBLIC_*` untuk provider.
- Jangan log raw prompt, isi percakapan, teks evidence penuh, chain-of-thought,
  token, authorization header, atau raw provider response.
- Telemetry default hanya correlation ID, tahap, durasi, status, jumlah item,
  provider/model identifier non-secret, usage numerik bila tersedia, dan alasan
  fallback yang dinormalisasi.
- Tidak ada data pengguna yang dipakai untuk training, evaluasi eksternal, atau
  dibagikan lintas provider tanpa persetujuan baru.

## Penyimpanan dan retensi

Phase 1 tidak menambah penyimpanan percakapan server-side. Riwayat v1 tetap di
localStorage browser dan pengguna dapat menghapusnya melalui UI. Kontrak v2 yang
ditambahkan hanyalah schema; belum ada endpoint atau persistence v2.

Jika persistence server diusulkan kemudian, desain wajib menetapkan tujuan,
dasar persetujuan, field allowlist, enkripsi, akses, ekspor/penghapusan, backup,
retention period, dan audit sebelum implementasi. Tidak boleh memakai retensi
tak terbatas sebagai default.

Research-only corpus tidak boleh masuk history/saved content yang dapat dipahami
sebagai data publik. Aturan local-only, larangan copy/save, serta isolasi dari
approved+verified corpus tetap berlaku.

## Provider boundary

- Provider hanya dipanggil dari adapter backend yang dikonfigurasi admin.
- Request provider harus menggunakan context/evidence minimum dan bounded;
  metadata internal, database credentials, serta provenance yang tidak diperlukan
  tidak dikirim.
- Capability, endpoint, region/retention terms, data-use policy, quota, dan biaya
  provider LLM harus didokumentasikan dan disetujui sebelum Phase 5.
- Tidak ada automatic cross-provider fallback. Pergantian provider adalah
  konfigurasi eksplisit supaya data tidak berpindah ke vendor lain diam-diam.
- Respons vendor divalidasi dan dinormalisasi; raw payload tidak diteruskan ke web.

## Logging, insiden, dan hak pengguna

Correlation ID dibuat di ingress dan boleh ditampilkan agar pengguna dapat
melaporkan kegagalan tanpa membagikan isi percakapan. Error publik tidak boleh
memuat stack, SQL, endpoint provider, atau secret.

Jika kebocoran data atau logging raw content ditemukan, hentikan jalur provider
terkait, pertahankan evidence teknis yang tidak mengandung konten sensitif, dan
laporkan scope serta mitigasi sebelum mengaktifkannya kembali.

## Gate fase berikutnya

Phase 2 hanya boleh memakai prompt sintetis pada adapter tests; tidak boleh mengirim
conversation/evidence pengguna karena belum ada business integration. Phase 3–4
tidak boleh memperluas data provider. Phase 5+ berhenti sampai provider
privacy/capability/cost disetujui. Deployment berhenti sampai production security,
retention, publication approval, dan rollback review selesai.
