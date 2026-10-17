# 08 — Testing, Evaluation & Local Sign-Off

## Automated tests
- Unit: QueryNormalization, DTO validation, allowed publication filter, search fusion (fixed deterministic inputs), mapper, citation serialization.
- Provider adapters: Cloudflare mock response, malformed JSON, non-1024 vector, 429/503, abort timeout.
- Integration: Nest route tests for health/sources/search/hadiths with repository mocked; true DB integration optional after approval.
- UI: keyboard new chat, submit, filters, empty/error/loading, bookmark/history localStorage, mobile responsive.
- Security: SQL injection input, no secret in client bundle/logs, input >300, pagination overflow, CORS origins.

## Human evaluation
`tests/search-evaluation.csv` contains 30 natural language searches. Expected hadith IDs intentionally blank until a verified corpus is curated; fill answer key manually and independently. Evaluate Recall@10, Precision@10 and MRR@10 on the labeled set, compare lexical vs hybrid.

## Non-functional
- UI must be legible on 360–390px mobile viewport and 1440px desktop.
- RTL Arabic in detail view, text can be selected/copied accurately.
- Loading/error states responsive when API delayed or unavailable; mock must not claim real references.
- No model/GPU memory usage: verify no model binaries and no Ollama/Docker services.
- API errors have request ID, no stacktrace or secret to user.
- Logs redact query text where unnecessary and always redact auth tokens.

## Definition of done after G5
1. Both services run on localhost, can restart independently.
2. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` exit with status 0.
3. Mock search works entirely offline (after `npm install`).
4. Lexical search returns only verified + source-approved DB records.
5. Cloud embedding runs remotely and failure falls back to lexical; no generative response.
6. Query results clearly cite source and numbering scheme and open actual source URL when data exists.
7. Evaluation report states real number of verified records, measured quality and remaining failures; no imaginary benchmark.
8. No attempt to deploy before the user requests it.

## Evidence file
Agent generates `LOCAL_HANDOFF.md` with OS/runtime version, commands, URLs, checked gates, automated test output, live query samples **with citation**, blockers, screenshots and future backlog.
