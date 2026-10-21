# Phase 6 — Provider Readiness Audit

Tanggal audit: 21 Oktober 2026  
Status live inference: **NOT RUN**

## Ringkasan

Arsitektur cukup siap untuk evaluasi model terbatas, tetapi belum siap untuk
aktivasi publik. `LlmProvider`, retrieval-first orchestration, evidence ledger,
server citation validation, timeout/cancellation, dan fallback sudah terpisah dari
Cloudflare SDK/transport. Default provider tetap `disabled`; tidak ada inference
pada startup atau unit test.

Audit source menunjukkan live integration masih memiliki risiko yang tidak bisa
dibuktikan oleh mock. Semua risiko di bawah menjadi gate evaluasi, bukan alasan
untuk mengaktifkan provider secara otomatis.

## Audit per lapisan

| Area                 | Bukti aktual                                                                                                              | Status                    | Risiko live yang tersisa                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider contract    | `generate`, `stream`, abort signal, normalized usage/error, model capabilities                                            | Siap untuk probe          | Kontrak tidak menjamin kecocokan chat template atau kualitas semantik model                                                                                                                          |
| Model configuration  | Provider/model/token hanya dari server environment; model request harus sama dengan configured model                      | Fail closed               | Any syntactically valid `@cf/...` model gets basic-generate descriptor; no runtime catalog pin or deprecation probe                                                                                  |
| Capability registry  | Llama 3.1 8B descriptor has documented 32k context/native SSE; unknown models advertise no tools/structured output/stream | Conservative              | Registry is one hardcoded verified model, not a versioned catalog; candidate models need explicit descriptor evidence and contract tests                                                             |
| Token/context bounds | Output tokens bounded; message count/characters bounded; orchestrator uses a conservative character budget                | Partial                   | Character count is not tokenizer count; provider-specific input/output maxima and reasoning-token behavior are unmeasured                                                                            |
| Timeout/cancellation | Nested abort budgets at orchestrator and adapter; caller abort normalized                                                 | Ready for controlled test | Provider may complete after client abort; no retry/backoff policy for LLM; timeout distribution is unknown                                                                                           |
| Concurrency          | Capability/config expose max concurrency; internal API has admission limit                                                | Partial                   | Adapter/orchestrator do not enforce a global provider semaphore outside the internal API                                                                                                             |
| HTTP errors          | 401/403, 408/504, 429, 5xx and invalid bodies normalized                                                                  | Safe but coarse           | Cloudflare-specific 403 model-terms/paid-plan and 429 quota/capacity causes collapse into broad codes; diagnostic metadata is intentionally lost                                                     |
| Generate parsing     | Bounded response, strict success envelope, response string, optional usage                                                | Ready for probe           | Real envelope drift, missing usage, finish reason variants, and non-JSON/model-specific payloads remain untested live                                                                                |
| SSE parsing          | Response byte bound, incremental decode, `data:` JSON parsing, usage normalization                                        | Foundation only           | No multiline SSE aggregation, event/error field handling, finish reason propagation, decoder final flush validation, or empty-stream rejection; orchestrator does not consume provider-native stream |
| Telemetry            | Correlation/model/operation/latency/outcome/error/token counts; no prompt, response, header, secret                       | Privacy-safe baseline     | In-memory only, 100 records; no neuron/cached-token/cost dimensions, percentile aggregation, durable export, or alerting                                                                             |
| Orchestrator         | Retrieval-first non-tool path, bounded context, revalidation, strict JSON draft, server citation validation               | Strong offline evidence   | Reformulation failure conservatively forces evidence-only; strict JSON from models without verified structured output may have a high fallback rate                                                  |
| Grounding            | Only eligible evidence enters prompt; citation IDs are server-issued/revalidated                                          | Hardened in Phase 6       | Semantic paraphrase can still overstate content; exact-copy and grade/status overclaim are now rejected, but general theological/factual overstatement requires real-model review                    |
| Privacy              | Raw prompt/response absent from app telemetry                                                                             | Baseline                  | External processing still requires user approval; optional AI Gateway logging can retain prompt/response and must stay off or be separately approved                                                 |

## Source-owned output controls

The server, not the model, remains authoritative for exact Arabic, translation,
source metadata, verification/publication state, and citation rendering. Phase 6
adds fail-closed checks so a generated draft is rejected when it:

- embeds a UUID, temporary citation ID, or URL;
- copies an entire normalized exact Arabic/Indonesian evidence string;
- claims a grade/status such as sahih, hasan, dhaif, fabricated, or equivalent;
- returns malformed JSON, duplicate/unknown citation IDs, or oversized output.

Rejection returns the already-existing `evidence_only` response. This is a safety
boundary, not proof that all hallucination or semantic overclaim classes are
solved.

## Provider documentation checked

- Cloudflare's current Llama 3.1 8B page documents 32k context, REST input/output,
  SSE, and optional usage fields:
  <https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/>
- Workers AI error documentation distinguishes invalid model, model agreement,
  paid-plan requirement, request size, timeout, quota, and capacity errors:
  <https://developers.cloudflare.com/workers-ai/platform/errors/>
- Workers AI data-usage terms state no model training from Customer Content and
  zero retention for standard stateless inference, with exceptions for selected
  stateful/logging features:
  <https://developers.cloudflare.com/workers-ai/platform/data-usage/>
- AI Gateway logging may include prompt and response and is enabled by default for
  a gateway; it is therefore outside the approved direct-adapter path:
  <https://developers.cloudflare.com/ai-gateway/observability/logging/>

Documentation claims are not substituted for account-specific contractual review.

## Readiness verdict

- Offline pipeline evaluation: **READY and executed**.
- One-request synthetic live contract probe: **mechanism ready, NOT RUN**.
- Real semantic model matrix: **blocked at explicit approval gate**.
- Research-only external evaluation: **prohibited without new data approval**.
- Public conversational AI: **not ready and not authorized**.
