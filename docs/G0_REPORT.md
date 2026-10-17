# G0 — Laporan verifikasi

Tanggal: 16 Oktober 2026 (Asia/Jakarta). Scope hanya G0; G1 tidak dikerjakan.
**Status: G0 LULUS.** Lint, typecheck, tes HTTP, build, format, audit dependency,
dan smoke test kedua server lulus. Tidak ada blocker G0 yang tersisa.

## Audit dan keputusan

- Kit dibaca: START_HERE, AGENTS, TASKS, seluruh `agent/`, `docs/01–10`, SQL,
  kontrak OpenAPI/JSON, templates, ADR-001, references, CSV evaluasi, dan gambar
  acuan. Dokumen kit tetap menjadi source of truth.
- OS: Windows x64, `Microsoft Windows 10.0.26200` dari RuntimeInformation.
- Awal: Node 26.8.1 / npm 12.0.2 dari `C:\nvm4w\nodejs`; NVM hanya memiliki
  26.8.1. Git 2.55.0.windows.5; folder awal belum merupakan repository Git.
- Pengujian: Node **24.22.0 Krypton LTS**, npm **11.19.1**, win32 x64. Node
  portable resmi ada di `.tools/node-v24.22.0-win-x64`, diabaikan Git. Tidak
  mengubah instalasi Node global. Git diinisialisasi tanpa commit/deploy.
- SHA256 arsip Node cocok dengan SHASUMS256 resmi:
  `f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3`.
- Dependency utama: Next 16.4.2, Nest 12.1.3, Nest CLI 12.0.8, Tailwind 4.3.3,
  TypeScript 5.9.3. Satu lockfile root. Keputusan: `decisions/ADR-002.md`.
- Halaman fondasi App Router; health controller → service; exception filter
  aman; environment divalidasi; server loopback; CORS dua origin lokal bawaan.
- Hanya mock diterima pada G0. Health tidak menguji DB dan mengembalikan
  `databaseConfigured: false`; tidak ada kredensial/integrasi cloud.

## Perintah dan hasil nyata

Perintah npm dijalankan dari root setelah PATH sesi diarahkan ke Node LTS lokal:

```powershell
$env:Path = "$PWD\.tools\node-v24.22.0-win-x64;$env:Path"
$env:NEXT_TELEMETRY_DISABLED = '1'
```

| Perintah                                                                         | Hasil yang sudah selesai                                                                                                                  |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `node --version`, `npm --version`                                                | `v24.22.0`, `11.19.1`                                                                                                                     |
| `npm install --no-fund --fetch-retries=1 --fetch-timeout=60000`                  | Exit 0; 544 paket ditambah; 5 high dari rantai lint, kemudian ditangani                                                                   |
| `npm audit --json` (awal)                                                        | Exit 1; 5 high pada rantai braces/micromatch/fast-glob/eslint-config-next                                                                 |
| `npm install --prefer-offline --no-fund --fetch-retries=0 --fetch-timeout=30000` | Exit 0; 62 paket dihapus, 485 diaudit, **0 vulnerabilities**                                                                              |
| `npm run lint`                                                                   | Exit 0; kedua workspace, `--max-warnings 0`, tanpa error/warning lint                                                                     |
| `npm run typecheck` (ulang dengan akses proses normal)                           | Exit 0; API tsc, web typegen + tsc; `Types generated successfully`                                                                        |
| `npm test`                                                                       | Exit 0; **2 passed, 0 failed**, durasi runner 45304.688 ms                                                                                |
| `npm run format:check`                                                           | Exit 0; `All matched files use Prettier code style!`                                                                                      |
| `npm run build`                                                                  | Exit 0; Nest build sukses; Next Turbopack `Compiled successfully in 80s`, TypeScript selesai 4.1s, halaman `/` dan `/_not-found` dibangun |
| `npm run dev`                                                                    | Berjalan terus; satu orchestrator memulai web 3000 dan API 4000; web ready 1557 ms, API watcher `Found 0 errors`, route health terpetakan |
| `npm run test:smoke`                                                             | Exit 0; 3 baris PASS untuk halaman + CSS Tailwind, health + kedua origin lokal, dan origin eksternal tanpa header akses                   |
| `npm ls --depth=0`                                                               | Exit 0; kedua workspace dan dependency terselesaikan tanpa missing/invalid peer                                                           |

Tes HTTP menjalankan NestJS asli pada port loopback acak dan menutupnya. Cakupan:
default/invalid environment, health JSON, dua origin CORS, OPTIONS preflight,
penolakan header CORS untuk domain luar/port lain/domain tiruan, dan safe 404
dengan request ID. Belum ada tes UI pencarian karena G1 di luar scope.

Output smoke test:

```text
PASS web: HTTP 200, Indonesian G0 page, API link, compiled Tailwind CSS
PASS API: HTTP 200, health JSON, both localhost CORS origins
PASS CORS: external origin has no access-control-allow-origin
```

URL yang benar-benar diakses saat kedua server hidup dari satu `npm run dev`:

- `http://localhost:3000` → HTTP 200; halaman G0 berbahasa Indonesia.
- `http://localhost:4000/api/v1/health` → HTTP 200:
  `{"status":"ok","mode":"mock","databaseConfigured":false}`.

Proses development dibiarkan berjalan untuk pemeriksaan pengguna. Build lokal
bukan deployment. Paket contracts belum dibuat karena belum dibutuhkan G0.

| Kriteria G0                                                 | Status                            |
| ----------------------------------------------------------- | --------------------------------- |
| Audit kit, Node LTS, keputusan dependency dan lockfile      | Lulus                             |
| npm workspaces, Next App Router dan NestJS terpisah         | Lulus                             |
| Strict TypeScript, Tailwind, ESLint, env, README, formatter | Lulus                             |
| Health, CORS terbatas dan satu root dev command             | Lulus                             |
| Lint, typecheck, test dan build tanpa error                 | Lulus                             |
| G1–G6                                                       | Belum dikerjakan; tetap unchecked |

Kegagalan awal yang wajib dicatat:

- Fetch metadata Node/npm dalam sandbox gagal DNS (`ENOTFOUND`); akses jaringan
  diulang lewat izin tool, lalu berhasil. Instalasi awal lambat, sekitar 13 menit.
- Audit OS via CIM dibatasi sandbox; informasi OS diambil dari RuntimeInformation.
- `git status` awal gagal karena belum ada repository; kemudian `git init` sukses.
- Typecheck awal: API tsc lewat, web `next typegen` gagal SWC canonicalize path
  dengan `Access is denied (os error 5)` dalam sandbox. Perintah root yang sama
  diulang dengan izin proses Windows normal dan **lulus**. Konfigurasi strict
  tidak diturunkan.
- Audit awal menemukan [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  pada braces tanpa patch. Rantai tersebut dihapus dengan mengganti
  `eslint-config-next` menjadi flat config TypeScript + React Hooks + JSX a11y.
  Tidak memakai `npm audit fix --force` atau downgrade framework.

## File dibuat/diubah

File baru (path relatif terhadap root repository):

```text
.gitignore
.node-version
.npmrc
.nvmrc
.prettierignore
.prettierrc.json
README.md
package.json
package-lock.json
apps/web/
  AGENTS.md
  .env.local.example
  README.md
  package.json
  tsconfig.json
  next-env.d.ts
  next.config.ts
  postcss.config.mjs
  eslint.config.mjs
  app/globals.css
  app/layout.tsx
  app/page.tsx
apps/api/
  .env.example
  README.md
  package.json
  tsconfig.json
  nest-cli.json
  eslint.config.mjs
  src/app.module.ts
  src/create-app.ts
  src/main.ts
  src/common/api-exception.filter.ts
  src/config/environment.ts
  src/modules/health/health.controller.ts
  src/modules/health/health.service.ts
  test/foundation.test.cjs
scripts/smoke.mjs
decisions/ADR-002.md
docs/G0_REPORT.md
```

`TASKS.md` diperbarui hanya setelah gate teruji. Artefak lokal yang diabaikan Git:
`apps/web/.env.local`, `apps/api/.env`, `.tools/`, `node_modules/`, `.next/`,
`dist/`, dan tsbuildinfo. Environment lokal berisi default contoh tanpa secrets.
`apps/web/AGENTS.md` dihasilkan otomatis oleh Next 16.4 saat `next dev`; instruksi
versi tersebut dibaca, termasuk dokumentasi bundled instalasi, layout dan CSS.

## Risiko dan batas

- ESLint 9.39.5 memberi peringatan deprecation saat instalasi. Plugin JSX a11y
  yang dipakai masih membatasi peer ESLint hingga 9. Ini keterbatasan dev tool;
  audit dependency akhir 0, dan lint berhasil. Migrasi saat plugin mendukung 10.
- Node global masih 26.8.1; pilih Node 24 LTS sesuai README untuk mengulang hasil.
- Next dev memberi warning filesystem lambat (benchmark 792 ms); kompilasi dan
  HTTP smoke tetap berhasil. Ini catatan performa environment, bukan build error.
- Tidak ada corpus hadits, izin sumber, DB, AI, atau pencarian. Ini bukan blocker
  G0, tetapi gate berikutnya harus tetap mengikuti governance kit.
- Tidak ada PostgreSQL/Docker/model lokal, integrasi Neon/Cloudflare, login,
  deployment, atau perubahan arsitektur. Tidak ada klaim G1–G5 telah lulus.
