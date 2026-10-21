# Matanexa vNext — Phase 5 Implementation Report

Date: 21 October 2026  
Scope: Internal Conversational API & Streaming Foundation  
Result: passed; Phase 6 has not started

## Roadmap reconciliation

The historical Phase 5 described grounded non-streaming orchestration. Phase 4
already completed that scope and part of the historical Phase 6 capability-aware
tool loop: provider-neutral orchestration, deterministic retrieval-first planning,
native-tool capability gating, evidence collection/revalidation, citation
validation, and evidence-only/no-evidence fallback.

The user's newer Phase 5 authorization therefore defines the remaining boundary as
internal API v2 plus normalized SSE transport. It also advances the safe transport
contract/lifecycle portion of historical Phase 7, but not provider-native answer
streaming or a frontend event reducer. The change and its impact on Phase 6/7 are
recorded in `docs/MIGRATION_PLAN.md` and ADR-012 before runtime implementation.

No orchestration, retrieval engine, provider adapter, evidence validator, search
ranking, or corpus policy was reimplemented.

## Implementation

### Shared transport contracts

- `conversationTurnRequestSchema` wraps the strict bounded Phase 4 context.
- The request rejects system/tool roles, provider metadata, evidence payloads,
  temporary citation IDs, and unknown fields.
- Six versioned SSE event variants are discriminated and strict:
  `message_started`, `status_changed`, `reference_added`, `text_delta`,
  `message_completed`, and `error`.
- Every event carries request ID, monotonic sequence, timestamp, and normalized
  data. Vendor response/event payloads are not part of the contract.
- `text_delta.source` explicitly distinguishes `buffered_validated` from the
  future reserved `provider_native_validated` mode.

### Internal API v2

- `POST /api/v2/internal/conversations/turn` returns a revalidated shared
  `ConversationTurnResult`.
- `POST /api/v2/internal/conversations/turn/stream` returns normalized SSE.
- Both call `ConversationApiService`, which delegates to the existing
  `ConversationOrchestratorService`. The controller imports neither provider nor
  retrieval/database implementations.
- The API remains stateless and accepts bounded history. Stable assistant record
  IDs are revalidated by the existing orchestrator. No persistence/schema was
  introduced.
- The API v2 paths are explicitly excluded from the existing `/api/v1` global
  prefix. Existing v1 controller paths and payloads are unchanged.

### Fail-closed access

- `INTERNAL_CONVERSATION_API_ENABLED=false` is the default.
- Activation is rejected unless `NODE_ENV=development|test` and a backend-only
  printable ASCII key of 32–256 characters is configured.
- Requests must use `X-Matanexa-Internal-Key`. Hashes are compared with a
  constant-length timing-safe operation; query-string credentials are unsupported.
- Disabled access returns the standard 404. Missing/wrong credentials return the
  normalized 401 envelope.
- The API still binds to loopback. CORS is explicitly not treated as access
  control, and production activation is rejected twice: configuration and guard.

### Validated SSE and lifecycle

- `message_started` and orchestration status may be sent while work is running.
- Answer/reference events are constructed only after the Phase 4 orchestrator has
  completed output parsing and server-side citation validation.
- Current `text_delta` is one buffered safe completion, never represented as native
  provider token streaming. Raw provider deltas are never exposed.
- The post-validation result batch is preflighted against the SSE byte budget
  before any reference/text is written. Oversized output produces one safe error.
- An overall API timeout races the orchestration and aborts its signal.
- Disconnect abort propagates to provider/retrieval call paths. No terminal event
  is attempted on a destroyed socket.
- Admission control rejects work above the configured concurrency. A timed-out or
  disconnected operation retains its slot until the underlying operation settles,
  preventing ignored cancellation from exceeding the actual limit.
- Connected streams emit exactly one terminal `message_completed` or `error`.

## Files created

- `packages/contracts/src/v2/conversation-api.ts`
- `apps/api/src/modules/conversations/conversation-api.error.ts`
- `apps/api/src/modules/conversations/conversation-api.service.ts`
- `apps/api/src/modules/conversations/conversation-sse.writer.ts`
- `apps/api/src/modules/conversations/conversation.controller.ts`
- `apps/api/src/modules/conversations/internal-conversation.guard.ts`
- `apps/api/test/conversation-api.test.cjs`
- `docs/PHASE5_API_DESIGN.md`
- `docs/PHASE5_STREAMING_CONTRACT.md`
- `docs/PHASE5_IMPLEMENTATION_REPORT.md`
- `decisions/ADR-012.md`

## Files changed

- `packages/contracts/src/index.ts`, `packages/contracts/src/common.ts`
- `packages/contracts/test/contracts.test.cjs`
- `apps/api/src/config/environment.ts`, `apps/api/.env.example`
- `apps/api/src/create-app.ts`
- `apps/api/src/modules/conversations/conversation.module.ts`
- `apps/api/test/foundation.test.cjs`
- `AGENTS.md`, `apps/api/README.md`, root `README.md`, root `package.json`
- `docs/MIGRATION_PLAN.md`, `docs/CONVERSATIONAL_ORCHESTRATION.md`
- `docs/CONVERSATIONAL_ENGINE_DESIGN.md`, `TASKS.md`

No file under `db/` or functional frontend source was changed by Phase 5. The
production web build rewrote generated `apps/web/next-env.d.ts`; it was restored to
its prior development declaration. Existing uncommitted Phase 0–4 work and earlier
user changes, including `package-lock.json`, were preserved.

## Verification actually run

Implementation-stage checks:

- API build passed after adding the shared transport and controller/service.
- Targeted Phase 4/5 contracts, environment, orchestration, and API/SSE suite after
  the final routing/admission changes: 31 passed, 0 failed, 0 skipped.
- Final API-only rerun after adding HTTP/SSE request-correlation assertions: 8
  passed, 0 failed, 0 skipped.
- API lint and typecheck passed. No lint/typecheck repair cycle was required.
- Actual `createApp` tests prove default-disabled 404 and explicitly activated
  `/api/v2/internal/...` routing; the prefixed `/api/v1/api/v2/...` path remains 404.

Final root verification:

- `npm run lint` — passed for contracts, API, and web.
- `npm run typecheck` — passed for contracts, API, web, and E2E TypeScript.
- `npm test` — 74 passed (9 contracts + 65 API), 0 failed, 0 skipped.
- `npm run build` — passed for contracts, NestJS API, and Next.js production web;
  route `/` prerendered successfully.
- `npm run test:db` — 2 passed, 0 failed, 5 skipped. Live hybrid HTTP and live
  lexical HTTP regressions passed. Dedicated `TEST_DATABASE_URL`, ignored local
  pilot source/prepared fixtures, and `RUN_LIVE_CLOUDFLARE_LLM=1` were absent; those
  suites are **NOT RUN**, not passed.
- Targeted Prettier check and `git diff --check` — passed after report completion.

No live conversational LLM request was made. Tests use deterministic provider and
retrieval fixtures. Browser E2E was not run because Phase 5 makes no frontend
change and the internal access key is intentionally not a browser credential.

## Required scenario coverage

| Scenario                                                 | Result                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Valid internal request and deterministic grounded answer | Passed through real orchestrator + retrieval executor test harness     |
| Invalid strict request                                   | Passed; 400                                                            |
| Disabled endpoint                                        | Passed; indistinguishable 404                                          |
| Unauthorized access                                      | Passed; normalized 401                                                 |
| Evidence-only and no-evidence                            | Passed through JSON API                                                |
| Invalid/stale citation                                   | Passed by existing orchestrator regressions; generated prose discarded |
| Research-only public isolation                           | Passed by existing orchestrator regression                             |
| Multi-turn propagation/reformulation                     | Passed through JSON API with provider history/query assertions         |
| SSE ordering and exactly one terminal                    | Passed                                                                 |
| Client disconnect cancellation                           | Passed; abort observed by orchestrator double                          |
| Overall timeout                                          | Passed; terminal safe SSE error                                        |
| Concurrency limit                                        | Passed fail-closed admission test                                      |
| SSE output bound                                         | Passed; no partial text/completion                                     |
| API v1 compatibility                                     | Passed mock HTTP plus live lexical/hybrid regression                   |

## Acceptance

1. Existing orchestrator is callable through internal API v2: passed for JSON and
   SSE.
2. API v2 is disabled by default and access-controlled: passed environment, guard,
   real-app routing, disabled, and unauthorized tests.
3. Streaming contract is stable and validated: passed shared-schema serialization,
   ordering, sequence, output-bound, and terminal tests.
4. No unvalidated AI religious content reaches the client: passed by the
   post-validation batch barrier and invalid-citation regressions.
5. Cancellation and timeout are safe: passed; PostgreSQL limitation remains
   explicitly documented.
6. Multi-turn context is forwarded: passed with complete history and reformulated
   retrieval query assertions.
7. API v1 is compatible: passed deterministic and available live regressions.
8. Deterministic regressions pass: 74/74.
9. No database, frontend, or deployment change: passed by source/diff audit.

## Known limitations

- SSE answer delivery is buffered and validated, not provider-native token
  streaming. The provider `stream()` port is intentionally not used here.
- There is no heartbeat, replay, `Last-Event-ID` resume, frontend reducer, server
  conversation persistence, or internet-grade authentication/rate limiting.
- The internal access key is suitable only for the current loopback
  development/test boundary. Production activation is intentionally impossible.
- If an adapter ignores abort, admission remains occupied until it settles. This is
  safer than allowing concurrency to exceed the configured maximum but can make the
  internal API temporarily unavailable.
- PostgreSQL cannot yet guarantee cancellation of an already-dispatched query.
- Deterministic mocks prove transport/safety behavior, not semantic quality of a
  real model. Cloudflare LLM live integration was not opted in.
- Public approved+verified corpus permission remains unresolved. Internal access
  does not permit research-only evidence to become a public answer.

## Rollback

Remove `ConversationController`, `ConversationApiService`, access guard, SSE writer,
and their providers/controller registration from `ConversationModule`; remove the
two API v2 prefix exclusions, Phase 5 environment fields/contracts/tests/docs, and
ADR-012. Keep `ConversationOrchestratorService` internal as it was at the end of
Phase 4. API v1, provider/retrieval foundations, database, ranking, embeddings, and
frontend continue unchanged. No data or schema rollback is required.

## Remaining blockers and next gate

- Phase 6 must be re-scoped before work because Phase 4 already implemented much
  of its historical capability-aware tool-loop foundation.
- Provider-native validated streaming and frontend consumption remain deferred to
  a separately approved future phase.
- Public activation requires approved authentication/security design, corpus
  permission/verification, privacy/quota/cost review, and a real-model test plan.
- Dedicated database credentials and ignored pilot fixtures are needed to execute
  all currently skipped integration suites.

Phase 6, frontend integration, real provider streaming, public AI, persistence,
local LLM, paid-service activation, and deployment have not started.
