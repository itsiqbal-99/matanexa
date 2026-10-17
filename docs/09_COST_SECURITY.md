# 09 — Rp0, resources, privacy and constraints

## Local resources
No CUDA/GPU, no Ollama or LLM local. React/Next dev and Nest watch run on CPU; recommended 8 GB RAM, possible with 4 GB while other apps are closed; actual performance depends on laptop. Database stays on free Neon; AI via external REST only.

## Expenses
- Development toolchain: Git, VS Code, Node.js/npm (free).
- DB: Neon Free; verify current storage/compute quotas in provider account, never auto-upgrade. Free tier and rate limits can change.
- AI: Cloudflare Workers AI free daily neuron quota; index asynchronously in throttled batches within quota, avoid embedding same hadith on every search.
- Domain/production deployment **out of scope**; do not purchase or configure.

## Security
- Backend owns all credentials: `DATABASE_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (account ID less secret but still configured server-side).
- `.env*` secrets gitignored; `.example` configs contain placeholders only.
- DTO validation and parameterized queries; safe source URLs and no raw HTML from dataset rendered.
- Limit request length/page size, timeout cloud calls, caching optional with low TTL.
- Client local history has Delete All; no user tracking/analytics/auth in MVP.
- AbortController in UI to prevent mixed results; clearly label stale/error.
- Don't put user queries in production logs by default or transmit them to analytics; sending to Cloudflare for embedding is a disclosed third-party service interaction.

## If quotas exhausted
Disable hybrid gracefully and keep lexical; if DB quota exhausted, stop import and notify developer instead of paying; if offline, mock can still show UI, but cannot claim to search real hadiths.
