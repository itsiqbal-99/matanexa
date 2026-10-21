# Matanexa vNext — Phase 6 Implementation Report

Date: 21 October 2026  
Scope: Real LLM readiness and semantic evaluation — offline first  
Status: **IMPLEMENTATION COMPLETE; EXTERNAL REGRESSION BLOCKED; LIVE NOT RUN**

## Roadmap reconciliation

The historical Phase 6 described a capability-aware tool loop. Source inspection
confirmed that Phase 4 already implemented its material foundation: capability
checks, static tool allowlist, validated arguments, bounded executions,
deterministic retrieval-first fallback, evidence ledger, and citation validation.
Phase 5 then added a default-disabled internal JSON/SSE transport.

Per ADR-013, Phase 6 was therefore changed to provider readiness audit, model
evaluation planning, deterministic offline evaluation, grounding hardening, and a
live approval gate. No second orchestration loop was created.

## Implemented

- Added a strict 16-case dataset spanning formal/casual/slang Indonesian,
  multi-turn follow-up, summary, source follow-up, topic switch, ambiguity,
  no-evidence, fake citation, exact-text ownership, status overclaim,
  research/public isolation, timeout, invalid output, and disabled provider.
- Added a reproducible runner using the real orchestrator and retrieval executor
  with deterministic provider/gateway doubles.
- Reported retrieval, context, reformulation, eligibility, citation, fallback,
  contract, and normalized-error checks separately.
- Prepared latency, failure, fallback, rejection, usage, and nullable cost fields.
- Hardened generated drafts: complete exact evidence text and unsupported
  grade/status claims now fail closed to `evidence_only`.
- Strengthened the existing Cloudflare live test so one synthetic request requires
  privacy, quota/cost, data-scope, token/request ceiling, credentials, and explicit
  inference approvals. The test remains separate and was not run.
- Documented current hosted candidates, pricing/privacy source links, known adapter
  risks, evaluation rubric, and stop conditions.

## Files

Created:

- `apps/api/evaluation/phase6-offline-cases.json`
- `apps/api/src/evaluation/phase6/phase6-evaluation.types.ts`
- `apps/api/src/evaluation/phase6/phase6-evaluation.runner.ts`
- `apps/api/src/evaluation/phase6/phase6-evaluation.cli.ts`
- `apps/api/test/phase6-evaluation.test.cjs`
- `decisions/ADR-013.md`
- `docs/PHASE6_MODEL_EVALUATION_PLAN.md`
- `docs/PHASE6_PROVIDER_READINESS.md`
- `docs/PHASE6_EVALUATION_RESULTS.md`
- `docs/PHASE6_IMPLEMENTATION_REPORT.md`

Updated:

- `apps/api/src/modules/conversations/conversation-orchestrator.service.ts`
- `apps/api/test/llm-live.integration.cjs`
- `apps/api/.env.example`
- `apps/api/package.json`
- `package.json`
- `docs/MIGRATION_PLAN.md`
- `TASKS.md`

## Verification

Final verification commands and actual output are recorded after implementation:

- `npm run conversation:evaluate:offline`: 16/16 offline cases passed; live
  inference `NOT_RUN`; semantic model quality `NOT_EVALUATED`.
- `npm test`: PASS — 9/9 shared-contract tests and 67/67 API unit/HTTP tests
  (76 total), including the 2 new Phase 6 tests.
- `npm run lint`: initial run FAILED on five new runner lint findings; all were
  corrected. Final run PASS across contracts/API/web with zero warnings.
- `npm run typecheck`: PASS across contracts/API/web and E2E configuration.
- `npm run build`: PASS — contracts TypeScript, NestJS API, and Next.js production
  build (3 static pages) completed.
- `npm run test:db --workspace @matanexa/api`: FAILED — 0 passed, 2 failed, 5
  skipped. Both configured database-backed HTTP suites received safe HTTP 503
  instead of 200; live LLM remained `NOT RUN`, and three other external suites
  skipped for missing prerequisites.
- `npm run db:check`: FAILED with safe `DATABASE_OPERATION_FAILED`; credentials
  were not printed. This confirms the database dependency was unavailable and the
  external failures cannot be called regression passes.
- `npm run format:check`: FAILED on 101 pre-existing repository files. None of the
  Phase 6 source/test/docs files appeared in the warning list; unrelated files
  were preserved instead of being reformatted wholesale.

No live LLM command was executed.

## Acceptance

| Criterion                                         | Result                                    |
| ------------------------------------------------- | ----------------------------------------- |
| Provider readiness audit complete                 | PASS                                      |
| Reproducible evaluation dataset                   | PASS                                      |
| Offline harness executes                          | PASS — 16/16                              |
| Core existing regressions pass                    | PASS — 76/76                              |
| Configured external DB regressions pass           | BLOCKED/FAIL — DB unavailable; 2 safe 503 |
| Repository-wide format baseline                   | FAIL — 101 pre-existing files             |
| Live procedure and approval gate explicit         | PASS                                      |
| No real-model quality claim without live evidence | PASS                                      |

## Known limitations and blockers

- Current capability registry only verifies one Cloudflare LLM model. Candidates
  remain fail-closed basic generate until separately tested.
- Real Indonesian semantics, context understanding, output consistency, latency,
  timeout/failure rates, token usage, and cost are unmeasured.
- SSE parsing has the limitations documented in the readiness audit and is not
  used by the orchestrator for provider-native conversational streaming.
- There is still no approved+verified public corpus. Research-only data remains
  ineligible for external/public use.
- General semantic overclaim detection cannot be fully guaranteed by lexical
  output policies; human-reviewed real-model evaluation is still required.

## Rollback

Remove the Phase 6 fixture, runner, CLI/test, scripts, ADR/docs, and revert the
additional generated-output policy checks and live-test gate variables. There is
no database/data rollback because no schema, corpus, index, or migration changed.
Phase 1–5 behavior remains available.

## Stop point

Phase 6 offline is complete. Work stops at the live evaluation approval gate.
Phase 7, deployment, paid activation, public AI, frontend changes, and corpus
publication were not started.

Because the explicit acceptance criterion requires every available regression to
pass, the phase cannot be marked fully accepted while the configured external DB
suites remain red. Re-run them when database connectivity is restored; do not
substitute skips or mock results for that evidence.
