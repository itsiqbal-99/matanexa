# Matanexa vNext — Phase 5 Internal Conversation API Design

Status: implemented as a default-disabled internal backend surface on 21 October 2026. It is not a public AI API.

## Boundary

Phase 5 exposes the existing Phase 4 orchestrator without duplicating its logic:

```text
strict shared request
  -> internal access guard
  -> transport admission/timeout/cancellation
  -> ConversationOrchestratorService
  -> normalized JSON or validated SSE
```

The controller does not import a provider, retrieval gateway, database repository,
or vendor type. Evidence collection, public/research isolation, stable-record
revalidation, and final citation validation remain owned by the orchestrator and
retrieval executor.

## Endpoints

Both endpoints accept the same strict body:

```json
{
  "context": {
    "version": 2,
    "conversationId": "uuid",
    "messages": []
  }
}
```

- `POST /api/v2/internal/conversations/turn` returns one validated
  `ConversationTurnResult` as JSON.
- `POST /api/v2/internal/conversations/turn/stream` returns normalized SSE. Phase 5
  buffers answer/reference content until orchestration and citation validation
  complete.

The body is strict. Clients cannot add system/tool messages, provider metadata,
evidence payloads, temporary citation IDs, execution state, or arbitrary URLs.
Bounded multi-turn user/assistant history is supported by the shared contract.

## Access control

The routes exist in the NestJS application but fail closed unless all conditions
hold:

1. `INTERNAL_CONVERSATION_API_ENABLED=true`;
2. `NODE_ENV` is `development` or `test`;
3. `INTERNAL_CONVERSATION_API_KEY` is printable ASCII, 32–256 characters;
4. the request supplies that value in `X-Matanexa-Internal-Key`.

The default is disabled. Disabled access returns the same normalized 404 as a
missing route. Invalid/missing credentials return 401. Keys are hashed before a
constant-length timing-safe comparison and are never accepted in query strings,
responses, telemetry, or frontend configuration.

The API process continues to bind to `127.0.0.1`. CORS remains restricted but is
not considered authentication. Production activation is rejected by environment
validation and the runtime guard. A future internet-facing surface requires an
approved authentication/security phase; this internal key is not that system.

## Lifecycle controls

- `CONVERSATION_API_TIMEOUT_MS`: overall request budget, default 45000 and bounded
  to 1000–120000 ms.
- `CONVERSATION_API_MAX_CONCURRENCY`: fail-closed admission count, default 2 and
  bounded to 1–8. Timed-out work retains its slot until the underlying operation
  acknowledges abort and settles.
- `CONVERSATION_SSE_MAX_OUTPUT_BYTES`: complete stream byte budget, default 262144
  and bounded to 4096–1048576.
- Client disconnect aborts the transport signal, which propagates into the Phase 4
  provider/retrieval signal path.
- JSON output is parsed again with the shared result schema before transport.
- Errors map to stable safe codes; stack, SQL, provider payload, prompt, evidence
  text, and secret details are not included.

PostgreSQL work still has the documented limitation: the HTTP caller stops waiting
and the provider path is aborted, but an already-dispatched `pg` query may finish
within the existing database statement timeout.

## State

The API is stateless. Every body carries its bounded history. Assistant history may
contain stable hadith record IDs, which the orchestrator re-fetches under the
current corpus policy. Temporary citation IDs and evidence snapshots are never
accepted as durable state. No database table, authentication record, session,
cookie, or localStorage behavior is introduced.

## Safe outcomes

- `grounded`: generated prose passed output parsing and server citation validation.
- `evidence_only`: evidence is returned but generated prose was disabled, failed,
  timed out, or did not pass the safety gates.
- `no_evidence`: no eligible evidence exists and answer generation was not called.

Research-only evidence remains rejected by public policy. Enabling the internal
route does not enable the LLM provider; `AI_LLM_PROVIDER=disabled` remains its own
default and returns safe evidence-only/no-evidence behavior.
