# Matanexa vNext — Phase 2 Implementation Report

Date: 21 October 2026  
Scope: AI provider abstraction and capability foundation  
Result: passed; Phase 3 has not started

## Scope alignment

The migration plan originally limited Phase 2 to extracting the existing
embedding provider. The user's Phase 2 authorization explicitly added the LLM
port, Cloudflare LLM adapter, deterministic mock, generate/stream contracts,
capability validation, normalized errors/telemetry, and an OpenAI-compatible
extension boundary. `docs/MIGRATION_PLAN.md` and ADR-008 now record that expansion.

This remains provider foundation only. No conversation controller, persistence,
tool execution, evidence orchestration, frontend change, database migration,
public inference, local model, paid-service activation, or deployment was added.

## Implementation

### Provider-neutral boundary

- `LlmProvider` defines generate, normalized stream events, caller cancellation,
  timeout budget, capability metadata, normalized usage, and model-independent
  request/response types.
- `EmbeddingProvider` now owns the active BGE-M3 model and 1024-dimension
  descriptor. `SearchService` injects `EMBEDDING_PROVIDER` and no longer imports a
  Cloudflare class.
- `ProviderError` normalizes configuration, authentication, quota, timeout,
  abort, unavailable, invalid response, unsupported capability, and policy errors.
- `ProviderTelemetryCollector` stores only bounded execution metadata and numeric
  usage; no prompt, raw response, authorization header, or secret.

### Adapters and configuration

- `CloudflareEmbeddingAdapter` preserves the previous endpoint, batch/input
  bounds, response validation, BGE-M3/1024 behavior, counters, and fallback error
  compatibility.
- `CloudflareLlmAdapter` uses injected native fetch, a backend-configured model,
  response byte limits, timeout/caller abort, normalized non-streaming and SSE
  output, status mapping, and privacy-safe telemetry.
- `MockLlmProvider` and `MockEmbeddingProvider` are deterministic test doubles.
  `DisabledLlmProvider` is the default runtime LLM binding.
- `AI_LLM_PROVIDER=cloudflare` requires backend account ID, token, and a valid
  `@cf/...` model. The default is `disabled`; no model has a default.
- Future OpenAI-compatible implementations use the same `LlmProvider` port.
  Static endpoint policy distinguishes HTTPS hosted endpoints from explicit HTTP
  loopback self-hosted profiles; no Ollama/vLLM/local model was installed or run.

## Files created

- `apps/api/src/providers/provider-contract.ts`
- `apps/api/src/providers/provider-telemetry.ts`
- `apps/api/src/providers/provider.module.ts`
- `apps/api/src/providers/embedding/embedding-provider.ts`
- `apps/api/src/providers/embedding/mock-embedding.provider.ts`
- `apps/api/src/providers/llm/llm-provider.ts`
- `apps/api/src/providers/llm/cloudflare-llm.adapter.ts`
- `apps/api/src/providers/llm/mock-llm.provider.ts`
- `apps/api/src/providers/llm/disabled-llm.provider.ts`
- `apps/api/src/providers/llm/openai-compatible.ts`
- `apps/api/test/provider.test.cjs`
- `apps/api/test/llm-live.integration.cjs`
- `docs/PROVIDER_CAPABILITY_MATRIX.md`
- `docs/PHASE2_IMPLEMENTATION_REPORT.md`

## Files changed

- `apps/api/src/providers/embedding/cloudflare-embedding.ts`
- `apps/api/src/modules/search/search.module.ts`
- `apps/api/src/modules/search/search.service.ts`
- `apps/api/src/modules/search/semantic.repository.ts`
- `apps/api/src/database/index-embeddings.cli.ts`
- `apps/api/src/config/environment.ts`
- `apps/api/.env.example`
- `apps/api/package.json`, root `package.json`
- `AGENTS.md`, `README.md`, `TASKS.md`
- `decisions/ADR-008.md`
- `docs/AI_PROVIDER_DESIGN.md`, `docs/MIGRATION_PLAN.md`,
  `docs/PRIVACY_RETENTION_POLICY.md`

No file under `db/` or `apps/web/` was changed by Phase 2. Existing uncommitted
Phase 0/1 work and the user's earlier `package-lock.json` edits were preserved.

## Verification actually run

Implementation-stage checks:

- Initial targeted Prettier command reported that `.env.example` has no inferred
  parser; TypeScript typecheck in the same command still passed. The env file is
  plain key/value text and was checked manually.
- Initial API lint found 11 issues in new code (`require-await`, unused placeholder
  parameters, and an untyped stream chunk). They were corrected; the re-run passed.
- API typecheck passed.
- Existing and new API suite passed: 35 tests, 0 failures.
- `npm run test:llm:live --workspace @matanexa/api`: **NOT RUN** — 1 skipped
  because `RUN_LIVE_CLOUDFLARE_LLM` was not `1`. No remote inference call was made;
  credential availability was neither printed nor inferred.

Final root verification:

- `npm run lint` — passed for contracts, API, and web.
- `npm run typecheck` — passed for contracts, API, web, and E2E TypeScript.
- `npm test` — 40 passed (5 contracts + 35 API), 0 failed.
- `npm run build` — passed for contracts, NestJS API, and Next.js production web;
  route `/` prerendered successfully.
- Targeted Prettier check and `git diff --check` — passed.

## Acceptance

- Cloudflare and mock providers implement the same `LlmProvider` abstraction:
  passed by contract tests.
- Business search does not import Cloudflare implementation: passed.
- OpenAI-compatible/self-hosted inference can implement the same port without
  orchestration changes: contract and endpoint policy present; no adapter/runtime
  installed.
- Streaming/tools/structured-output capabilities fail closed: passed.
- Timeout, caller cancellation, invalid response, auth/quota/unavailable mapping,
  configuration bounds, and telemetry redaction: passed.
- BGE-M3 model, 1024 dimensions, indexing SQL/count/hash/retry, ranking, API v1,
  and corpus gates: unchanged.

## Known limitations

- The Cloudflare capability registry currently verifies native streaming only for
  `@cf/meta/llama-3.1-8b-instruct-fp8`; tools and structured output remain disabled.
  Unknown models get basic generation only until evidence and tests are added.
- The adapter normalizes common Cloudflare SSE data shapes but has no live evidence
  in this run because the opt-in live test was not enabled.
- `maxConcurrency` is capability/configuration metadata; centralized admission
  control belongs with the future provider executor/orchestration boundary.
- Hosted endpoint policy rejects literal private/link-local targets, but DNS
  resolution and rebinding defenses remain Phase 9 production hardening.
- There is no LLM business consumer, citation validator, conversation endpoint, or
  automatic evidence-only fallback yet; those remain later phases.

## Rollback

No data rollback is required. Rebind `SearchService` to the legacy concrete
embedding adapter, restore the model constant imports, remove `ProviderModule` and
new provider files/config fields/tests, and leave database/vector rows untouched.
Because LLM is disabled and unused, removing its token/adapters has no v1 runtime
or data effect.

## Remaining blockers

- Public corpus permission and independent verification remain unresolved.
- Cloudflare LLM model/privacy/quota/cost approval is still required before any
  business integration or live/public inference.
- Phase 3 is not started and requires explicit approval.
- Deployment remains unauthorized.
