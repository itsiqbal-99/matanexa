# Agent prompts bila ONE_SHOT terlalu besar

Copy satu prompt per fase, sambil menyertakan seluruh kit. **Baca AGENTS.md dan referensi lain dulu setiap fase.**

## Phase A — G0: Monorepo
"Implementasikan G0 dari TASKS.md, gunakan Next.js App Router pada apps/web, NestJS pada apps/api, npm workspaces, ports 3000/4000, scripts nyata, env examples, health endpoint, CORS lokal dan READMEs. Jangan tambah database/AI atau deployment. Jalankan semua test yang tersedia dan laporkan bukti."

## Phase B — G1: UI
"Implementasikan G1 sepenuhnya berdasarkan docs/02_UX_UI.md dan assets/chat-ui-reference.png. Data mock tidak boleh menyerupai hadits asli. Responsivitas desktop/mobile, semua interactions dan state harus nyata. Jangan menyentuh cloud/deploy."

## Phase C — G2: DB/API
"Implementasikan NestJS modules, kontrak OpenAPI, migrasi SQL via Node, prepared SQL, test repository + endpoints, query publik verified+approved only. Gunakan Neon hanya setelah kredensial ada; lanjut test mocks tanpa credential. Jangan gunakan Next backend."

## Phase D — G3: Lexical
"Lakukan audit izin & verifikasi dataset (docs/04). Integrasi corpus nyata hanya bila approved+verified; implement FTS simple + pg_trgm + synonyms, pagination, benchmark CSV. Jika tidak bisa verifikasi, laporkan blocker, jangan seed materi religious palsu."

## Phase E — G4: Hybrid
"Implement embedding provider REST Cloudflare BGE-M3 di NestJS (1024 dim), idempotent batch indexing, cosine search + lexical RRF, real mode/fallback; uji quota timeout, malformed response. Gunakan fake provider untuk test, tanpa model lokal."

## Phase F — G5: Signoff
"Audit ALL TASKS G0–G5, jalankan lint,typecheck,test,build, benchmark dan visual regression desktop/mobile. Fix sampai green dalam batas yang tersedia. Buat LOCAL_HANDOFF.md jujur tentang data approved, metrics, blocker. Tidak deploy."
