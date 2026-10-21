# Matanexa vNext — Phase 3 Implementation Report

Date: 21 October 2026  
Scope: Retrieval Tool & Evidence Foundation  
Result: passed; Phase 4 has not started

## Scope alignment

The approved migration plan defined Phase 3 as extraction of retrieval, fusion,
and evidence boundaries around the existing PostgreSQL implementation, with
explicit metadata and golden regressions. The user's Phase 3 authorization kept
that goal and explicitly added typed search/detail/related/reference-validation
tools, a static allowlist, Zod validation, timeout, request correlation, normalized
errors, research isolation, and output bounds.

This expansion is recorded in `docs/MIGRATION_PLAN.md` and ADR-010. It does not
pull future conversational orchestration or the capability-aware model tool loop
into Phase 3. No conversation controller, agent loop, LLM call, public tool
endpoint, persistence, frontend change, database migration, alternate vector
store, local model, paid-service activation, or deployment was added.

## Implementation

### Provider- and storage-neutral tool boundary

- `RetrievalGateway` exposes only typed `search` and `findById` operations.
- `PostgresRetrievalGateway` delegates to the existing `SearchService` and
  `HadithRepository`; it does not duplicate lexical SQL, semantic SQL, query
  analysis, RRF, filters, or ranking.
- `RetrievalToolExecutor` creates request-correlated sessions with four statically
  allowlisted tools: `search_hadith`, `get_hadith_detail`,
  `retrieve_related_evidence`, and `validate_evidence_references`.
- Mock search placeholders are excluded from evidence. There is no arbitrary SQL,
  dynamic function dispatch, client-selected relation, or client URL.

### Evidence and citation integrity

- The strict shared evidence schema carries stable record ID, complete exact
  Arabic/Indonesian text, reference/source/provenance metadata, normalized
  verification/publication status, citation ID, and policy eligibility.
- Citation IDs are random, server-issued, opaque, and scoped to a private tool
  session. Repeated retrieval of the same record reuses the ledger entry.
- Validation rejects duplicate or unknown IDs, re-fetches through the same corpus
  gateway, and compares exact text, reference, source, provenance, and policy
  fields. A syntactically valid citation invented by an LLM remains invalid.
- Public policy rejects research-only records even if an adapter returns one.
  Development `local_pilot` evidence stays explicitly research-only. Existing
  approved+verified+non-simulation database views are unchanged.

### Execution safety

- Zod schemas are strict; queries are 3–300 characters, result limits are 1–10,
  source filters are bounded/unique, UUIDs are required, and citation validation is
  limited to 20 IDs.
- Server-only `RETRIEVAL_TIMEOUT_MS` and `RETRIEVAL_MAX_OUTPUT_BYTES` are bounded.
  Exact evidence is never truncated; oversized results fail.
- Caller cancellation propagates to the existing embedding provider. Database work
  is bounded from the caller's perspective and by the existing PostgreSQL timeout.
- Errors are normalized without leaking SQL, provider payloads, raw prompts,
  secrets, or stack traces.
- Hybrid candidate count is labeled `retrieval_window`; lexical/fallback count is
  labeled `exact`.

## Files created

- `packages/contracts/src/v2/retrieval.ts`
- `apps/api/src/modules/retrieval/retrieval.gateway.ts`
- `apps/api/src/modules/retrieval/postgres-retrieval.gateway.ts`
- `apps/api/src/modules/retrieval/retrieval-tool.error.ts`
- `apps/api/src/modules/retrieval/retrieval-tool.executor.ts`
- `apps/api/src/modules/retrieval/retrieval.module.ts`
- `apps/api/test/retrieval.test.cjs`
- `docs/RETRIEVAL_TOOL_DESIGN.md`
- `docs/EVIDENCE_CONTRACT.md`
- `docs/PHASE3_IMPLEMENTATION_REPORT.md`
- `decisions/ADR-010.md`

## Files changed

- `packages/contracts/src/index.ts`, `packages/contracts/test/contracts.test.cjs`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/environment.ts`, `apps/api/.env.example`
- `apps/api/src/modules/search/search.module.ts`
- `apps/api/src/modules/search/search.service.ts`
- `apps/api/test/foundation.test.cjs`
- `apps/api/test/pilot.integration.cjs`
- `apps/api/README.md`, root `README.md`, root `package.json`
- `docs/MIGRATION_PLAN.md`, `docs/RETRIEVAL_PORTABILITY.md`, `TASKS.md`

`pilot.integration.cjs` now marks absent ignored local-pilot files as skipped rather
than failing with `ENOENT`; its assertions are unchanged when fixtures exist. No
file under `db/` or `apps/web/` was changed by Phase 3. Existing uncommitted Phase
0–2 work and the user's earlier `package-lock.json` edits were preserved.

## Verification actually run

Implementation and repair runs:

- Targeted contracts + retrieval tests: 17 passed, 0 failed.
- Initial API lint found one redundant type assertion; it was removed.
- A subsequent API lint/typecheck/test run failed because the associated return
  type import was removed with that assertion. The type-only import was restored.
- API lint and typecheck then passed; API suite passed 45/45.
- Initial `npm run test:db` inside the sandbox: 0 passed, 4 failed, 3 skipped. The
  database was unreachable there and ignored local-pilot files were absent.
- First out-of-sandbox retry: live hybrid and lexical HTTP passed; two pilot tests
  still failed only because ignored local files were absent; three tests skipped.
- After adding honest prerequisite guards, final `npm run test:db`: 2 passed, 0
  failed, 5 skipped. `TEST_DATABASE_URL`, local pilot source/prepared files, and
  the explicit Cloudflare LLM live-test gate were absent, so those are **NOT RUN**,
  not passed.

Final root verification:

- `npm run lint` — passed for contracts, API, and web.
- `npm run typecheck` — passed for contracts, API, web, and E2E TypeScript.
- `npm test` — 52 passed (7 contracts + 45 API), 0 failed.
- `npm run build` — passed for contracts, NestJS API, and Next.js production web;
  route `/` prerendered successfully.
- Targeted Prettier checks and `git diff --check` — passed after report completion.

Read-only discovery also encountered three harmless path probes: the repository has
`db/migrations` rather than `apps/api/migrations`, request context is under
`src/common`, and there is no root `tsconfig.base.json`. A PowerShell `rg` wildcard
was replaced with direct file paths. None changed repository state.

The root `format:check` command was also attempted before this report existed. It
failed on the missing report path and 102 pre-existing repository-wide formatting
warnings. Phase 3 files were formatted and checked separately; unrelated files
were not bulk-reformatted.

## Acceptance

1. Existing hybrid search is callable through a typed tool: passed. The PostgreSQL
   adapter delegates to `SearchService` and forwards cancellation.
2. Evidence validation is independent of an LLM: passed.
3. Citations cannot target absent, changed, duplicate, or unregistered evidence:
   passed.
4. Research-only evidence cannot enter a public-policy ledger: passed.
5. API v1 remains compatible: passed by existing HTTP/contract regressions and the
   live lexical/hybrid integration tests.
6. Available deterministic suites pass: 52/52. External integration prerequisites
   that are absent are explicitly skipped; the two configured live HTTP suites pass.

BGE-M3, vector dimensions, index behavior, RRF weights, search ranking, database
schema, public corpus governance, and frontend behavior are unchanged.

## Known limitations

- `pg` queries do not currently consume an `AbortSignal`; a timed-out caller is
  released promptly, while an already-dispatched query may finish within the
  existing database statement timeout.
- Related evidence is existing search applied to a validated caller-supplied query
  plus seed exclusion. There is no relationship graph or new semantic policy.
- Citation ledgers are intentionally in-memory and execution-scoped. Conversation
  persistence and cross-turn evidence storage are outside Phase 3.
- No public approved+verified corpus exists yet. Live public HTTP regression can be
  empty and does not prove real public evidence availability.
- Dedicated `TEST_DATABASE_URL` and ignored pilot fixture suites were not run in
  the final integration command because those prerequisites were absent.

## Rollback

Remove `RetrievalModule` from `AppModule`, remove the retrieval module and shared
retrieval contract/tests, revert the optional `SearchService.search` call options
and export, and remove the two retrieval environment fields/docs. API v1 continues
to use the existing search and hadith paths. No data or schema rollback is needed.

## Remaining blockers

- Public corpus permission and independent verification remain unresolved.
- Dedicated database test credentials and ignored pilot files are needed to rerun
  the skipped external suites.
- Cloudflare LLM live inference remains opt-in and was not run.
- Phase 4, conversational behavior, public AI activation, and deployment require a
  new explicit approval.
