# 07 — Local Development on Windows (no GPU / no Docker)

## Prerequisites
- VS Code + Git + **current Node.js Active LTS** compatible with NestJS CLI and Next.js (check Nest generator's requirements; as of 2026 the CLI generators can require Node 22.22.3+/24.15+). Do not silently use an older Node.
- npm included with Node; use **npm workspaces** to avoid needing pnpm/yarn installs.
- Stable Internet for remote Neon + Cloudflare AI **only when lexical/hybrid enabled**. Mock mode should work offline after dependencies installed.

## Commands the AI agent must implement
```powershell
cd C:\projects\matanexa
npm install
Copy-Item apps\web\.env.local.example apps\web\.env.local
Copy-Item apps\api\.env.example apps\api\.env
npm run dev
```

Open `http://localhost:3000` (Next) and `http://localhost:4000/api/v1/health` (Nest). Scripts at root MUST start both via an explicit orchestrator like `concurrently` or npm workspaces, don't rely on nonexistent scripts.

## Environment defaults
Frontend `apps/web/.env.local`:
```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
```
Backend `apps/api/.env` for UI stage:
```dotenv
PORT=4000
APP_SEARCH_MODE=mock
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## Later: database (G2/G3)
1. Create a **free** Neon PostgreSQL project. Obtain its pooled or direct PostgreSQL connection URL (choose carefully for migrations); keep `.env` private.
2. Set `DATABASE_URL=postgresql://...` in Nest backend only, switch `APP_SEARCH_MODE=lexical`.
3. Run Node-based migration script implemented by agent (`npm run db:migrate`, no local `psql`).
4. Source/license approval & human verification before any real results are exposed.

## Later: semantic mode (G4)
1. In Cloudflare Workers AI dashboard create a scoped API token and copy account ID.
2. Put `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` **in backend env only**.
3. Index the verified corpus once with resumable `npm run db:index`; then `APP_SEARCH_MODE=hybrid`.
4. View modeUsed in network response; forcibly disable token during testing and ensure lexical fallback works.

## Troubleshooting
- `localhost:3000` works but search fails: check Nest 4000 and allowed CORS list.
- `relation does not exist`: apply schema migrations before lexical requests.
- database TLS/timeout: check Neon URL, branch/project active, provider availability; NEVER print complete connection string.
- `hybrid` errors: token/perms/response shape/quota; verify fallback, never block UI without message.
- `npm run dev` error Node engine: install supported Node LTS and reinstall node_modules; don't workaround with --force.
- port occupied: agent should document how to change both API and UI URLs consistently.
