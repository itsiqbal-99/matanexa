# Phase 6 — Offline Evaluation Results

Executed: 21 Oktober 2026  
Evaluation kind: `deterministic_pipeline_offline`  
Live inference: **NOT RUN**  
Semantic model quality: **NOT EVALUATED**

## Result

Command actually executed:

```text
npm run conversation:evaluate:offline
total 16; passed 16; failed 0; pass rate 1.0
provider failure simulations 4; safe fallbacks 6; citation rejections 1
deterministic mock token usage 192; cost estimate null
```

The command built shared contracts and API, loaded the strict JSON fixture, ran
the actual `ConversationOrchestratorService` and `RetrievalToolExecutor`, and
returned exit code 0. No network request, Cloudflare credential read, real hadith
record, local model, or paid service was used.

## Check matrix

| Check                     | Result                           | What it proves                                                                                      | What it does not prove                         |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Retrieval relevance       | 16/16 expected fixture sets      | Query reached existing typed retrieval path and expected stable IDs returned                        | Real hybrid relevance or corpus quality        |
| Context propagation       | All applicable cases passed      | User/assistant messages reached provider request without hardcoded intent routing                   | Real model understands the context             |
| Reformulation correctness | 16/16 deterministic expectations | Model-supplied query is validated and used; topic/follow-up route is correct                        | A real model will create a good query          |
| Evidence eligibility      | 16/16                            | Public path rejects research-only; successful outputs contain approved/verified fixture status      | Publication rights or real hadith verification |
| Citation validity         | All applicable cases passed      | Server-issued citations validate; invented citation falls back                                      | A model will cite consistently in live runs    |
| Fallback correctness      | 16/16                            | Disabled, timeout, malformed output, exact-copy, status overclaim, and invalid citation fail safely | Actual provider failure frequency              |
| Response contract         | 16/16                            | Success results parse shared strict schema; error case is normalized                                | Vendor envelope compatibility                  |
| Error handling            | 16/16                            | Expected research isolation error is normalized                                                     | Live quota/auth/capacity distributions         |

`null` in an inapplicable check is not counted as pass or failure. For example, no
provider call is expected when retrieval is empty, and citation validation is not
applicable to a no-evidence result.

## Performance fields

The runner captures retrieval, provider, and end-to-end duration per case, plus
provider-failure, fallback, citation-rejection, and token counters. These timings
come from in-process deterministic doubles and are deliberately not summarized as
production latency. The only meaningful timing assertion is that the simulated
provider timeout follows the configured abort path.

Cost is `null`: deterministic token counters are not billable usage and no live
model price was applied. A future real report must include sample count, model ID,
current price source, p50/p95, missing-usage count, and the calculation formula.

## Dataset integrity

Fixture: `apps/api/evaluation/phase6-offline-cases.json`.

- Every religious-looking record field is an explicit placeholder and labeled
  **BUKAN HADITS**.
- URLs use the reserved `.invalid` domain.
- Record IDs are deterministic test UUIDs.
- No result is evidence of a verified hadith or of real-model semantic quality.
- The research-only case is synthetic and verifies policy isolation only.

## Gate conclusion

The deterministic Phase 6 harness is green. Core regressions also passed 76/76,
but two configured external database suites returned HTTP 503 and `db:check`
reported `DATABASE_OPERATION_FAILED`; five external tests were skipped. Therefore
the “all available regressions pass” acceptance item is not claimed complete.

Real semantic quality, real latency, real token usage, real cost, provider envelope
compatibility, and account quota remain unmeasured. The next state is **RESTORE DB
REGRESSION PREREQUISITE, THEN WAIT FOR LIVE EVALUATION APPROVAL**, not Phase 7.
