# Matanexa vNext — Evidence Lifecycle

Status: Phase 4 orchestration lifecycle implemented without persistence.

## Identities

- `recordId` is the stable hadith identity and may appear in assistant conversation
  history.
- `citationId` is random, execution-scoped, and owned by one Phase 3 retrieval
  session. It must never be persisted as a permanent conversation reference.
- The evidence object is a current server snapshot containing exact text,
  attribution, provenance, verification/publication status, and eligibility.

The client cannot replay an evidence payload or citation ID as trusted data.

## Per-turn lifecycle

1. Create a new `RetrievalToolSession` using the server data policy.
2. Search through an allowlisted tool and register current evidence in its private
   ledger.
3. Collect stable `evidenceRecordIds` from bounded assistant history.
4. Re-fetch each reusable record through `get_hadith_detail`; missing/ineligible
   records increment the stale count and are not added.
5. Deduplicate current and historical evidence by stable record ID.
6. Give the provider only evidence that fits the context budget without truncating
   exact text.
7. Parse the proposed answer and citation ID list.
8. Call server-only `validate_evidence_references` in the same session. This
   re-fetches and fingerprints the current record again.
9. Return only validated evidence and stable record IDs with grounded output.
10. Discard the session ledger after execution.

## Failure behavior

- Stale history reference: omit it; never trust the previous snapshot.
- Citation absent/duplicate/invented: discard generated prose and return
  evidence-only.
- Record changed after retrieval: citation validation fails.
- Research-only record under public policy: fail closed before generation.
- Empty eligible ledger: explicit no-evidence response; no religious answer.
- Output too large: fail rather than truncate exact evidence.

## Persistence

Phase 4 adds no database table and no server conversation storage. A future client
may persist stable record IDs under a separately approved UI/localStorage phase,
but must not persist temporary citation IDs as durable references. Revalidation is
mandatory on every future turn.
