# Matanexa vNext — Phase 1 Implementation Report

Date: 21 October 2026  
Scope: contract governance and safety foundation only  
Result: passed; Phase 2 has not started

## Outcome

Phase 1 was implemented without changing database schema, search ranking,
provider calls, public corpus rules, or deployment state. `/api/v1` keeps its
existing response fields; every request now also has an `X-Request-ID` whose
value matches success `meta.requestId` or error `error.requestId` when that body
field exists.

The new `@matanexa/contracts` workspace contains only TypeScript/Zod
serialization contracts. The API consumes the shared v1 validation schema and
the web consumes shared v1 result types. The v2 conversation context is a schema
only: there is no endpoint, model call, streaming, or conversation persistence.

## Files created

- `packages/contracts/package.json`, `tsconfig.json`, and `eslint.config.mjs`
- `packages/contracts/src/common.ts`
- `packages/contracts/src/v1/search.ts`
- `packages/contracts/src/v2/conversation.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/test/contracts.test.cjs`
- `apps/api/src/common/common.module.ts`
- `apps/api/src/common/domain-error.ts`
- `apps/api/src/common/request-context.service.ts`
- `docs/PRIVACY_RETENTION_POLICY.md`
- `docs/IMPLEMENTATION_REPORT.md`

## Files changed

- root/package manifests: `package.json`, `package-lock.json`,
  `apps/api/package.json`, `apps/web/package.json`
- runtime integration: `apps/api/src/app.module.ts`, `create-app.ts`,
  `common/api-exception.filter.ts`, `modules/search/search.schema.ts`,
  `modules/search/search.service.ts`, `modules/hadiths/hadith.service.ts`, and
  `apps/web/features/search/types.ts`
- lint boundary: `apps/web/eslint.config.mjs`
- regression tests: `apps/api/test/foundation.test.cjs`,
  `apps/api/test/search.test.cjs`
- governance: `AGENTS.md`, `START_HERE.md`, `README.md`, `TASKS.md`,
  `docs/01_PRODUCT_SCOPE.md`, `docs/MIGRATION_PLAN.md`, and ADR-007–009

Phase 0 documentation created in the same working tree remains listed in the
Phase 0 handoff. The pre-existing `package-lock.json` edits were preserved; npm
added the new workspace links rather than replacing the file.

## Verification actually run

Targeted checks during implementation:

- `npm run typecheck --workspace @matanexa/contracts` — passed.
- `npm run lint --workspace @matanexa/contracts` — passed.
- `npm test --workspace @matanexa/contracts` — 5 passed, 0 failed.
- Initial API/web typecheck and API lint — failed because
  `@matanexa/contracts` had not yet been linked into `node_modules`; the
  unresolved type cascaded into lint/type errors. `npm install --ignore-scripts`
  added the local workspace link.
- Re-run API typecheck/lint and web typecheck — passed.
- `npm test --workspace @matanexa/api` — 26 passed, 0 failed.
- Initial root `npm run lint` — failed because the existing web ESLint config
  included the CommonJS smoke-test file without Node globals. The config now
  excludes `apps/web/tests/**`, consistent with the API workspace's test ignore;
  the root lint re-run passed.

Final root verification:

- `npm run lint` — passed for contracts, API, and web.
- `npm run typecheck` — passed for contracts, API, web, and E2E TypeScript.
- `npm test` — 31 passed (5 contracts + 26 API), 0 failed.
- `npm run build` — passed for contracts, NestJS API, and Next.js web; route `/`
  prerendered successfully.
- targeted `prettier --check` for all Phase 1 files — passed.

## Acceptance

- v1 golden HTTP behavior: passed through the existing 26-test API suite.
- Contract serialization round-trip: passed.
- Client role/provider metadata rejection: passed.
- Ingress-to-response correlation ID consistency: passed for health, search,
  sources, validation errors, and not-found errors.
- Privacy/retention/provider policy: documented and linked.
- Database/provider/browser live suites: not run because this phase does not
  change those boundaries; they remain separate gates and are not claimed.

## Rollback

No schema or data rollback is needed. Revert web/API imports to their former
local types/schema, remove request-context integration and the contracts
workspace, then remove the package manifests/lock entries. Existing v1 data and
database migrations are untouched.

## Remaining blockers and decisions

- Public corpus remains blocked by permission and independent human review.
- Phase 2 is not started and requires a separate execution step.
- LLM provider/model capabilities, privacy terms, and quota/cost remain undecided;
  they block Phase 5+, not local mock/lexical behavior.
- No deployment is authorized.
