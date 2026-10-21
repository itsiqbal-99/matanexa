# Matanexa vNext — Retrieval Tool Design

Status: implemented in Phase 3, 21 October 2026.

## Boundary

The retrieval tool layer is an internal NestJS capability. It has no controller,
public route, conversation loop, or LLM dependency. A future orchestrator may use
it, but Phase 3 only establishes the typed and bounded execution boundary.

`PostgresRetrievalGateway` delegates to the existing `SearchService` and
`HadithRepository`. Consequently lexical analysis, semantic retrieval, RRF `k=60`,
source filters, pagination rules, BGE-M3/1024 embeddings, lexical fallback, and the
`CorpusAccess` relation remain owned by the existing implementation. No search SQL
or ranking logic is duplicated in the tool layer.

```text
future orchestrator
  -> RetrievalToolExecutor (static allowlist, Zod, timeout, output bound)
    -> request-scoped RetrievalToolSession (private evidence ledger)
      -> RetrievalGateway port
        -> PostgresRetrievalGateway
          -> existing SearchService / HadithRepository
```

## Allowlisted tools

| Tool                           | Purpose                                                                        | Bounds                             |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------- |
| `search_hadith`                | Existing lexical/hybrid search                                                 | query 3–300, limit 1–10            |
| `get_hadith_detail`            | Exact eligible record by UUID                                                  | one UUID                           |
| `retrieve_related_evidence`    | Reuse search for a caller-supplied query and exclude an eligible seed record   | seed UUID, query 3–300, limit 1–10 |
| `validate_evidence_references` | Validate server-issued citations against the session ledger and current record | 1–20 unique citation IDs           |

The allowlist is a static switch. Unknown names, extra input properties, arbitrary
SQL, relation names, endpoint URLs, and unrestricted function dispatch are not
accepted. `retrieve_related_evidence` does not infer conversational intent; the
caller supplies a bounded query and the existing search engine performs retrieval.

## Execution lifecycle

1. `RetrievalToolExecutor.createSession()` captures the ingress request ID and the
   server data policy (`published` -> `public`, `local_pilot` -> `research`).
2. The selected allowlisted Zod schema parses input.
3. A server-configured timeout creates an abort signal. Embedding calls receive the
   signal; current `pg` repository calls are bounded from the caller's perspective.
4. The gateway delegates to existing search/detail code.
5. Mock placeholders are excluded because they are not religious evidence.
6. Records are deduplicated by stable record ID and converted to evidence without
   truncating the exact Arabic or Indonesian text.
7. A random opaque citation ID is registered in the private session ledger.
8. The complete envelope is checked against the server output-byte limit.

`RETRIEVAL_TIMEOUT_MS` defaults to 10000 and is restricted to 100–30000.
`RETRIEVAL_MAX_OUTPUT_BYTES` defaults to 262144 and is restricted to
16384–1048576. Tool result limits are contract constants and cannot be raised by
tool input.

## Retrieval metadata

The tool response distinguishes count semantics:

- `exact`: lexical, mock, and lexical fallback counts;
- `retrieval_window`: hybrid fused candidate-window count, not corpus-wide recall.

`modeUsed` and `fallbackReason` preserve the existing honest hybrid/fallback
semantics. Relevance scores and vector distances are not exposed as religious
truth or verification signals.

## Error contract

Errors are normalized to: `TOOL_NOT_ALLOWED`, `INVALID_INPUT`, `NOT_FOUND`,
`INVALID_CITATION`, `DUPLICATE_EVIDENCE`, `RESEARCH_ONLY_REJECTED`,
`PROVIDER_UNAVAILABLE`, `RETRIEVAL_UNAVAILABLE`, `TIMEOUT`, `ABORTED`, and
`OUTPUT_TOO_LARGE`. Every error carries the session request ID and does not include
raw SQL, provider payloads, prompts, secrets, or stack traces.

Embedding-provider failures still follow existing behavior: hybrid search normally
returns lexical fallback with a reason. `PROVIDER_UNAVAILABLE` exists for gateway
or future retrieval providers that cannot supply that fallback.

## Known limitation

The current `pg` wrapper has no per-query `AbortSignal`; therefore the tool returns
a timeout promptly, but an already-dispatched database query may finish in the
pool. The existing PostgreSQL statement timeout remains the database-side bound.
Adding cancellable DB transport is future hardening and does not change Phase 3
contract semantics.
