# Matanexa vNext — Phase 5 Streaming Contract

Status: normalized SSE transport implemented. Provider-native conversational token
streaming is not implemented or claimed in Phase 5.

## Wire format

The endpoint responds with `text/event-stream; charset=utf-8`. Every event has an
SSE `id`, `event`, and JSON `data` line. The JSON object itself is validated by the
shared `conversationStreamEventSchema`:

```json
{
  "version": 2,
  "requestId": "uuid",
  "sequence": 1,
  "emittedAt": "ISO-8601 timestamp",
  "event": "message_started",
  "data": {}
}
```

Sequence numbers start at one and increase by one within one HTTP stream. The
request ID correlates the stream with the HTTP response and internal orchestration
context. Raw vendor events never reach this contract.

## Events

| Event               | Meaning                                                                                                         | Terminal |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| `message_started`   | Request accepted for one stateless turn; delivery is declared `buffered_validated`.                             | No       |
| `status_changed`    | `orchestrating`, then `validated` with the final result status. This is orchestration state, not a model token. | No       |
| `reference_added`   | Full server-validated evidence selected by the final citation gate.                                             | No       |
| `text_delta`        | Safe assistant text emitted after validation. Current source is `buffered_validated`.                           | No       |
| `message_completed` | Complete normalized `ConversationTurnResult`.                                                                   | Yes      |
| `error`             | Safe error code/message/retryability after streaming has begun.                                                 | Yes      |

A successful grounded stream has this order:

```text
message_started
status_changed(orchestrating)
status_changed(validated)
reference_added (zero or more)
text_delta(buffered_validated)
message_completed
```

Evidence-only and no-evidence responses follow the same shape with their actual
validated result status. There is exactly one terminal event. A terminal event is
never followed by another write.

## Validation barrier

The Phase 4 orchestrator currently completes through `generate()`, not
`provider.stream()`. Phase 5 therefore does not expose provider deltas. It may send
status events while work is in progress, but buffers religious answer text and
references until all of these have completed:

1. retrieval and corpus-policy checks;
2. evidence registration/revalidation;
3. generated-output schema validation;
4. citation ledger validation and fresh evidence fingerprint checks.

Only then are `reference_added` and `text_delta` serialized. The `source` field
prevents a buffered completion from being misrepresented as native streaming.
`provider_native_validated` is reserved by the contract for a future phase and is
not emitted by this implementation.

## Cancellation and errors

Disconnect closes the response and aborts the orchestration signal. Because the
socket no longer exists, no synthetic terminal event is attempted after a client
disconnect. For connected clients, timeout, output-bound, or orchestration failure
ends with one `error` event.

Runtime SSE codes are normalized as `TIMEOUT`, `CONCURRENCY_LIMIT`,
`OUTPUT_TOO_LARGE`, `ABORTED`, or `ORCHESTRATION_FAILED`. Request validation and
access failures occur before SSE headers and use the normal JSON error envelope.

The writer reserves room for a terminal error and preflights the entire validated
result batch before writing any references/text. Thus an oversized result produces
an error without leaking a partial answer. Total buffered writes are server-bounded
to at most one MiB by configuration.

## Unsupported behavior

- No heartbeat/replay or `Last-Event-ID` resume.
- No server conversation persistence.
- No raw provider event or chain-of-thought.
- No simulated typing marketed as token streaming.
- No frontend reducer or API key in browser code.
- No guarantee that PostgreSQL cancels already-dispatched queries.
