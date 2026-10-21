# Matanexa vNext — Conversational Orchestration

Status: backend foundation implemented in Phase 4, 21 October 2026. Phase 5 adds a
default-disabled internal API/SSE transport; no public conversation endpoint is
enabled.

## Boundary

`ConversationOrchestratorService` is an internal NestJS service. It connects only
provider-neutral interfaces:

```text
validated ConversationContext
  -> bounded context selection
  -> capability-aware retrieval planning
  -> RetrievalToolExecutor session
  -> evidence collection and revalidation
  -> LlmProvider generation (only when explicitly configured)
  -> server-side citation validation
  -> grounded | evidence_only | no_evidence result
```

It does not import Cloudflare, PostgreSQL, SQL, or frontend code. Phase 4 itself
added no controller. Phase 5 wraps this unchanged service with strict internal JSON
and validated-buffered SSE routes; there is still no persistence, automatic startup
call, frontend integration, or public inference activation.

## Planning modes

### Deterministic retrieval-first

This is the safe path for providers whose `toolCalling` capability is `none`.

- A single-turn request searches the latest user message directly.
- For multi-turn context, an explicitly enabled LLM may rewrite the latest message
  into one standalone query. The full selected history is supplied; there is no
  keyword-to-intent mapping.
- Reformulation is strict text of 3–300 characters. It cannot encode function calls,
  SQL, URLs, record IDs, or evidence facts.
- Disabled, failed, timed-out, or invalid reformulation falls back to the latest
  user query with honest metadata. A provider failure then prevents generated
  prose and returns evidence-only.

### Native tool planning

This path is used only when the provider/model capability descriptor explicitly
reports `toolCalling: native`. The model sees three read-only definitions:
`search_hadith`, `get_hadith_detail`, and `retrieve_related_evidence`.

Every name is checked against the Phase 3 allowlist and every argument is validated
again by `RetrievalToolExecutor`. Unknown calls are ignored, execution count is
bounded, and the model never receives SQL/database access. Citation validation is
not exposed as a model tool; it remains a server-only final gate.

## Evidence-first generation

The model receives only bounded, server-validated evidence. It is instructed to
return strict JSON with explanatory text and citation IDs selected from that
evidence. Source attribution, hadith number, exact Arabic/translation, verification,
and provenance are rendered from server evidence—not copied from model output.

Generated output is rejected when it is malformed, oversized, contains direct
URLs/UUID/citation markers in prose, has no citation, repeats citations, or cites an
ID outside the execution ledger. The fallback is evidence-only; the service never
guesses or repairs citations.

No evidence means an explicit no-evidence response and zero answer-generation call.

## Resource controls

- Conversation contract: 1–20 messages, 4000 characters each, 40000 total.
- Runtime history: recent suffix selected using provider context capability and
  `ORCHESTRATION_MAX_CONTEXT_CHARS`.
- Context allocation reserves separate bounded portions for history and exact
  evidence; neither is silently truncated.
- Retrieval: Phase 3 timeout/output limits and caller cancellation.
- Generation: provider capability maximum plus server token, byte, and timeout
  bounds.
- Tools: `ORCHESTRATION_MAX_TOOL_EXECUTIONS`, default 4 and maximum 6.
- Result: `ORCHESTRATION_MAX_OUTPUT_BYTES`, checked after serialization.

## Fallbacks

| Condition                          | Result                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| No eligible evidence               | `no_evidence`; no generation                             |
| LLM disabled/unavailable/timeout   | `evidence_only`                                          |
| Invalid generated JSON/citation    | `evidence_only`                                          |
| Research evidence in public policy | fail closed                                              |
| Retrieval/database failure         | normalized orchestration error; no fake answer           |
| Caller cancellation                | `ABORTED`; propagated through retrieval/provider signals |

## Telemetry

The bounded in-memory collector stores request ID, provider/model identifiers,
final status, planning strategy, durations, counts, fallback code, and numeric token
usage when available. It does not store messages, reformulated queries, model text,
evidence text, provider payloads, secrets, or chain-of-thought.
