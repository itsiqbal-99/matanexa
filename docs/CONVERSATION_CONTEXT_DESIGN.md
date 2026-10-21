# Matanexa vNext — Conversation Context Design

Status: shared contract and backend context selection implemented in Phase 4.

## Client-safe context

The shared v2 context contains only:

```typescript
interface ConversationContext {
  version: 2;
  conversationId: UUID;
  messages: Array<UserMessage | AssistantMessage>;
}
```

User and assistant messages contain stable ID, role, bounded text, and timestamp.
Assistant history may additionally carry up to ten unique stable hadith record UUIDs
in `evidenceRecordIds`. User messages cannot submit evidence references. Client
contexts cannot submit `system`/`tool` roles, provider payloads, prompts, token
metadata, execution status, or temporary citation IDs.

Message IDs must be unique. The newest selected message must be from the user.
Context is supplied per execution and is not persisted on the server in Phase 4.

## Context selection

The orchestrator computes a conservative character budget from:

- the server `ORCHESTRATION_MAX_CONTEXT_CHARS` limit;
- the provider/model context window when known;
- fixed reserves for system policy, tool schemas, exact evidence, and output.

It retains a recent contiguous suffix, always including the latest user turn, and
reports selected/omitted counts. There is no automatic summary in this phase:
summaries could become untrusted pseudo-evidence and require a separate policy.

Follow-ups and topic changes are interpreted by the configured provider from the
selected history. Tests prove that the complete selected history reaches the mock
provider and that its reformulated query reaches retrieval. They do not claim a
real model's semantic quality.

## Domain result

The provider-independent result contains:

- assistant message and stable `evidenceRecordIds`;
- current execution-scoped evidence objects;
- final status: `grounded`, `evidence_only`, or `no_evidence`;
- planning strategy, context counts, tool count, stale-reference count, request ID,
  duration, and normalized fallback reason;
- normalized provider/model ID, call count, duration, and numeric usage.

`failed` and `aborted` are valid execution/telemetry states, but internal errors are
thrown as normalized `ConversationOrchestrationError` rather than serialized by a
new public endpoint.

No provider-specific response body, request ID, SDK type, raw prompt, raw response,
or chain-of-thought is part of the domain contract.

## Trust boundaries

Conversation text is untrusted context, not executable instructions. It cannot name
functions, supply SQL, select a corpus relation, change public/research policy, or
bypass tool schemas. Stable evidence record IDs from assistant history are hints
only; every reuse requires a fresh server-side detail lookup through the active
corpus policy.
