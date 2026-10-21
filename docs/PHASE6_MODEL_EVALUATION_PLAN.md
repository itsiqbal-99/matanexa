# Phase 6 — Model Evaluation Plan

Tanggal: 21 Oktober 2026  
Live evaluation status: **NOT RUN**

## Tujuan dan batas klaim

Evaluasi mendatang harus menjawab apakah model nyata cukup baik untuk bahasa
Indonesia informal, follow-up multi-turn, query reformulation, strict grounded
JSON, dan instruction following. Phase 6 offline hanya menguji pipeline dan
control plane; nilainya tidak boleh dipakai sebagai skor kualitas model.

Tool calling dan structured output bukan syarat minimal. Jalur utama tetap
provider-neutral retrieval-first, sehingga model dengan capability `none` dapat
dievaluasi tanpa memalsukan capability.

## Shortlist hosted

Shortlist berikut adalah kandidat evaluasi, bukan pilihan produksi dan bukan
capability registry runtime. Harga/ketersediaan adalah snapshot dokumentasi resmi
21 Oktober 2026 dan wajib dicek ulang tepat sebelum live run.

| Kandidat                                   | Sinyal dokumentasi                                                            | Konteks | Harga dokumentasi per 1M token (input/output) | Posisi evaluasi                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ------: | --------------------------------------------: | --------------------------------------------------------------------------------- |
| `@cf/meta/llama-3.1-8b-instruct-fp8`       | Existing adapter descriptor; multilingual instruct; native SSE documented     |  32,000 |                             USD 0.152 / 0.287 | Baseline termurah yang sudah dipin di adapter                                     |
| `@cf/qwen/qwen3-30b-a3b-fp8`               | Multilingual/instruction-following, reasoning and function calling advertised |  32,768 |                            USD 0.0509 / 0.335 | Candidate value; runtime tetap basic generate sampai capability tests ditambahkan |
| `@cf/google/gemma-4-26b-a4b-it`            | Multilingual, long context, reasoning/function calling advertised             | 256,000 |                               USD 0.10 / 0.30 | Candidate long-context; evaluate latency and instruction adherence                |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Larger instruct model and function calling advertised                         |  24,000 |                             USD 0.293 / 2.253 | Quality comparison only if quota/cost ceiling allows                              |

Official model pages:

- <https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/>
- <https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/>
- <https://developers.cloudflare.com/ai/models/%40cf/google/gemma-4-26b-a4b-it/>
- <https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/>

Cloudflare currently documents a 10,000-neuron daily free allocation and per-model
unit pricing. Some models require paid access. The account dashboard and selected
model page remain the authority at run time:
<https://developers.cloudflare.com/workers-ai/platform/pricing/>. Text-generation
rate limits are documented separately and are not a spending guardrail:
<https://developers.cloudflare.com/workers-ai/platform/limits/>.

## Dataset dan split

The checked-in offline dataset contains 16 deterministic cases:

- formal Indonesian, casual phrasing, slang/typo;
- contextual follow-up, short-summary request, source follow-up, topic switch;
- ambiguous/no-evidence queries;
- fake citation pressure, exact-text copy, grade/status overclaim;
- research-only/public isolation;
- timeout, invalid response, and disabled-provider fallback.

All records are conspicuous placeholders and **BUKAN HADITS**. For a future live
semantic run:

1. use the same user utterances and synthetic placeholder evidence first;
2. freeze expected reformulation and rubric before seeing candidate outputs;
3. use at least two independent human reviewers for Indonesian semantic scoring;
4. keep a hidden holdout split for final comparison;
5. never treat a generated answer as evidence that a hadith is verified;
6. do not transmit research-only corpus unless a separate data approval exists.

## Measurements

Report each layer separately; do not collapse everything into one score.

| Layer         | Metric                                                                     | Proposed criterion for limited pilot                                                                    |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Retrieval     | Hit@5/MRR and expected stable record coverage                              | No regression from frozen retrieval baseline; model reformulation compared against latest-user baseline |
| Context       | Relevant history preserved; topic switch obeyed; source follow-up resolved | 100% on safety-critical source/topic-switch set; reviewer score on language cases                       |
| Reformulation | Exact/accepted-query match plus retrieval outcome                          | Report both textual match and downstream retrieval delta                                                |
| Grounding     | Eligible evidence only; no unsupported factual claim                       | 100% eligibility/citation gates; any fabricated citation is hard fail                                   |
| Contract      | Strict JSON/result schema compliance                                       | Report first-attempt pass rate; fallback remains safe on failure                                        |
| Reliability   | Timeout, provider failure, fallback, citation rejection rates              | Measured per model and category, not inferred from mock                                                 |
| Performance   | Retrieval, LLM, end-to-end latency; TTFT only if native stream tested      | p50/p95 from actual samples with sample count                                                           |
| Usage/cost    | Input/output/total tokens; neuron or USD estimate if published             | Formula and missing usage explicitly reported; no estimated value presented as billed cost              |

Per-request price estimate, only when token usage and the current model prices are
both available:

`inputTokens / 1,000,000 × inputPrice + outputTokens / 1,000,000 × outputPrice`

Reasoning/cached tokens, neurons, free allocation, taxes, and plan charges must be
reported separately when applicable. If any field is unavailable, cost remains
`null`, as in the offline runner.

## Proposed live sequence after approval

1. Recheck model page, license/terms, pricing, free quota, and account eligibility.
2. Approve one model ID and add a tested fail-closed capability descriptor. Do not
   infer tools/JSON/SSE from model family names.
3. Run the existing one-request synthetic contract probe with at most 32 output
   tokens and a total explicit budget at most 64 tokens.
4. Review envelope, normalized error, usage, and telemetry without logging content.
5. Run a small synthetic semantic sample with a fixed request/token ceiling.
6. Compare model outputs through the rubric; stop on privacy, quota, citation,
   research-scope, or unexpected billing signals.
7. Only then propose a separate approval for corpus-backed evaluation.

## Mandatory approval record

All of the following must be explicitly true before any request:

- chosen `AI_LLM_MODEL` and documented capability descriptor;
- privacy/data-processing terms accepted by the data owner;
- `AI_LLM_LIVE_MAX_REQUESTS`, `AI_LLM_LIVE_MAX_TOKENS`, and total token budget;
- free-quota/cost ceiling confirmed for the account, with paid use still disabled;
- valid server-only account ID/token;
- `AI_LLM_LIVE_DATA_SCOPE=synthetic_only` for the first probe;
- explicit live inference approval.

The repository exposes these gates in `test/llm-live.integration.cjs`. Their mere
presence in an `.env` file is not authorization from the user. This Phase 6 run
stops before that gate.
