# Matanexa vNext — Phase 4 Implementation Report

Date: 21 October 2026  
Scope: Conversational Orchestration Foundation  
Result: passed; Phase 5 has not started

## Scope alignment

The migration plan previously assigned Phase 4 to conversation schema,
localStorage/UI migration, and a mock endpoint. The user's newer Phase 4
authorization explicitly replaces that work with a backend-only orchestration
foundation and prohibits frontend/public-AI changes. The old UI/localStorage and
mock-endpoint scope is therefore deferred rather than silently executed.

This phase advances the internal foundation portion of the old Phase 5/6 plan:
provider-neutral orchestration, bounded retrieval planning, evidence-first
generation, and citation validation. It does not add a controller, public API v2
route, streaming endpoint, persistence, frontend behavior, provider activation,
local model, paid service, deployment, or database migration. The difference and
future sequencing impact are recorded in `docs/MIGRATION_PLAN.md` and ADR-011.

## Implementation

### Provider-independent conversation domain

- The strict shared v2 contract permits only bounded user/assistant history,
  unique message IDs, and stable hadith record UUIDs on assistant history.
- Client context cannot submit system/tool roles, temporary citation IDs, evidence
  payloads, provider payloads, execution metadata, or chain-of-thought.
- The normalized result exposes grounded/evidence-only/no-evidence state,
  stable evidence identities, current validated evidence, execution counts,
  request correlation, timings, and numeric usage when available.
- Cloudflare-specific SDK/HTTP response shapes do not enter the conversation
  domain or orchestration service.

### Internal conversational orchestrator

- `ConversationOrchestratorService` depends only on the Phase 2 `LlmProvider` and
  Phase 3 `RetrievalToolExecutor` abstractions.
- A conservative suffix selector retains recent history within both server and
  provider capability bounds and always requires the latest selected message to
  be a user turn.
- Providers without native tool calling use deterministic retrieval-first
  orchestration. For multi-turn requests, an explicitly enabled provider may
  rewrite the selected history into one validated standalone search query.
- Tests cover the three-user-turn example (parents → mother → short status),
  verify the complete selected history sent to the provider, and verify the
  resulting query sent to retrieval. This proves orchestration wiring with a
  deterministic mock, not semantic quality of a live model.
- Providers declaring native tool support receive only three static read-only
  tool definitions. Unknown calls are ignored; accepted calls still pass through
  the existing allowlist and Zod validation. There is no text function parser,
  arbitrary dispatch, SQL, or direct database access.

### Evidence and citation lifecycle

- Retrieval registers current evidence in the Phase 3 execution-scoped ledger.
- Historical assistant references carry stable record IDs only. They are treated
  as hints and re-fetched through `get_hadith_detail` under the current policy.
- Evidence is deduplicated by stable record ID and supplied to the model only when
  it fits without truncating exact text.
- The model may propose only explanatory prose plus temporary citation IDs from
  the supplied ledger. Source attribution, exact Arabic/translation, number,
  provenance, verification, and publication metadata remain server-owned.
- `validate_evidence_references` re-fetches and fingerprints every proposed
  citation. Invented, duplicate, removed, changed, stale, or research-ineligible
  references fail closed. Invalid generated output is discarded.
- Empty retrieval makes no generation call. Disabled/unavailable/timed-out LLM or
  invalid output returns evidence-only with an explicit normalized reason.

### Resource, privacy, and activation controls

- Server configuration bounds history characters, provider output tokens,
  serialized output bytes, and tool execution count.
- Existing retrieval timeout/output policies and caller cancellation are reused;
  provider calls use the lower of server and model timeout capabilities.
- Capability metadata controls whether tool definitions or structured-output
  requests are sent. Unsupported models receive neither.
- The bounded telemetry collector stores IDs, state, strategy, durations, counts,
  fallback code, and numeric usage only. It stores no prompt, response, query,
  evidence text, provider payload, secret, or chain-of-thought.
- `AI_LLM_PROVIDER=disabled` remains the default. The module performs no inference
  at startup and has no public route.

## Files created

- `apps/api/src/modules/conversations/context-window.ts`
- `apps/api/src/modules/conversations/conversation.error.ts`
- `apps/api/src/modules/conversations/conversation-telemetry.ts`
- `apps/api/src/modules/conversations/conversation-orchestrator.service.ts`
- `apps/api/src/modules/conversations/conversation.module.ts`
- `apps/api/test/conversation.test.cjs`
- `docs/CONVERSATIONAL_ORCHESTRATION.md`
- `docs/CONVERSATION_CONTEXT_DESIGN.md`
- `docs/EVIDENCE_LIFECYCLE.md`
- `docs/PHASE4_IMPLEMENTATION_REPORT.md`
- `decisions/ADR-011.md`

## Files changed

- `packages/contracts/src/v2/conversation.ts`
- `packages/contracts/test/contracts.test.cjs`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/environment.ts`
- `apps/api/.env.example`
- `apps/api/test/foundation.test.cjs`
- `AGENTS.md`, `apps/api/README.md`, root `README.md`, root `package.json`
- `docs/MIGRATION_PLAN.md`, `docs/CONVERSATIONAL_ENGINE_DESIGN.md`, `TASKS.md`

No database migration, search/ranking implementation, embedding configuration,
corpus gate, public API v1 behavior, or frontend source was changed by Phase 4.
The production web build rewrote generated `apps/web/next-env.d.ts`; that change
was restored immediately. Existing uncommitted Phase 0–3 work and earlier user
changes, including `package-lock.json`, were preserved.

## Verification actually run

Implementation/repair history:

- Initial API build and typecheck passed.
- Initial API lint found one `no-empty-object-type` violation on the orchestration
  options interface. It was replaced by a type alias; subsequent lint passed.
- Targeted contract/conversation run after final multi-turn fixture update: 20
  passed, 0 failed, 0 skipped.
- Final `npm run test:db`: 2 passed, 0 failed, 5 skipped. Live hybrid HTTP and live
  lexical HTTP passed. The dedicated `TEST_DATABASE_URL` suites, ignored local
  pilot source/prepared fixtures, and explicit Cloudflare LLM live gate were
  unavailable and are **NOT RUN**, not passed. `RUN_LIVE_CLOUDFLARE_LLM` was not
  set to `1`.

Final root verification:

- `npm run lint` — passed for contracts, API, and web.
- `npm run typecheck` — passed for contracts, API, web, and E2E TypeScript.
- `npm test` — 65 passed (8 contracts + 57 API), 0 failed, 0 skipped.
- `npm run build` — passed for contracts, NestJS API, and Next.js production web;
  route `/` prerendered successfully.
- Targeted Prettier check and `git diff --check` — passed after report completion.

No live conversational LLM request was made. The tests use deterministic provider
and retrieval doubles; they do not claim that a real model's multi-turn semantic
quality has passed.

## Acceptance

1. Orchestrator works through `LlmProvider`: passed with scripted and disabled
   implementations; no vendor import exists in business logic.
2. Retrieval uses the existing tool executor: passed; all searches/details and
   final citation validation use a real `RetrievalToolExecutor` over fixtures.
3. Multi-turn context has no hardcoded conversational intent: passed for context
   propagation/reformulation and topic-switch wiring with deterministic mocks.
4. Citations are always server-validated before grounded output: passed.
5. Research-only evidence cannot become a public answer: passed fail-closed test.
6. Provider limitations are handled safely: passed for native/unsupported tools,
   structured output, disabled provider, timeout, cancellation, and bounds.
7. API v1 remains compatible: passed unit/HTTP regression and both available live
   lexical/hybrid HTTP suites; `/api/v2/conversations` remains 404.
8. Deterministic tests/build gates pass: 65/65 root tests and all root checks pass.

## Known limitations

- There is intentionally no conversation controller, public AI endpoint,
  streaming response, server persistence, frontend conversation UI, or durable
  citation ledger.
- A future client may persist stable record IDs only after an approved UI/API
  phase; temporary citation IDs remain execution-scoped and must never be reused.
- Query reformulation and native planning require an explicitly configured model.
  When disabled, a multi-turn request searches the latest user text and returns
  evidence-only rather than pretending semantic understanding.
- Deterministic mocks verify data flow and safety gates, not live-model answer
  quality. Cloudflare LLM live integration was not opted in.
- PostgreSQL queries inherit the Phase 3 limitation: caller timeout/cancellation
  stops waiting, while an already-dispatched query may finish within the existing
  database statement timeout.
- Public approved+verified corpus availability remains unresolved; orchestration
  cannot turn research-only data into public evidence.

## Rollback

Remove `ConversationModule` from `AppModule`; remove the conversation module,
Phase 4 tests/config fields, result-contract extension, docs, and ADR-011. The
Phase 2 provider abstraction, Phase 3 retrieval/evidence foundation, API v1,
database, indexing, ranking, and frontend continue unchanged. No data or schema
rollback is required.

## Remaining blockers and next gate

- Public corpus permission and independent verification remain unresolved.
- Dedicated database test credentials and ignored pilot files are needed to run
  all external integration suites.
- A real provider/model selection, privacy/cost approval, and explicit live-test
  opt-in are required before validating real semantic behavior.
- Phase 5 scope must be reconciled because part of its historical foundation was
  advanced here while the old frontend/localStorage Phase 4 was deferred.

Phase 5, public endpoint/UI activation, persistence, streaming, paid services,
local LLM, and deployment have not started and require explicit user approval.
