# Matanexa vNext — Test Strategy

Status: strategi berdasarkan suite aktual; test vNext belum diimplementasikan.

## Baseline saat audit

Suite aktual mencakup environment/CORS, HTTP envelopes, validation, mock safety,
normalization/ranking, migrations/import dengan doubles, database integration yang
credential-gated, Cloudflare embedding shape/fallback/telemetry, hybrid integration,
browser states, keyboard/accessibility, request abort, localStorage, URL/provenance,
dan pilot research isolation.

Run Phase 0:

- lint: pass;
- typecheck: pass;
- unit/HTTP: 26 pass, 0 fail/skip;
- production build: pass untuk API dan web;
- live DB/provider: tidak dijalankan;
- browser: tidak dijalankan karena port dipakai instance user hybrid/local_pilot.

## Test pyramid

### Contract/unit — selalu offline

- schemas dan serialization;
- provider adapter contract dengan fake transport;
- capability routing;
- message/context budgeting;
- tool registry/args validation;
- evidence/citation validator;
- normalized events dan reducer;
- localStorage migration;
- retrieval fusion/metadata semantics;
- error taxonomy/telemetry redaction.

### Application integration — offline/test doubles

- Nest controller -> orchestrator -> mock provider/retrieval;
- non-streaming and SSE normalized flows;
- abort/timeouts/idempotency;
- provider switching via config;
- deterministic retrieval-first fallback;
- research-only rejection at policy boundary.

### PostgreSQL integration — isolated branch/schema

- additive migrations/idempotency/drift;
- publication view and local research isolation;
- lexical/semantic filters identical;
- embedding collection dimension/hash/model rules;
- active collection switch/rollback;
- DB unavailable -> clear error, never fake content;
- conversation persistence tests hanya jika feature tersebut disetujui.

### Browser E2E — local mock by default

- legacy v1 search regression;
- multi-turn UI, topic follow-up/switch;
- storage v1 -> v2 migration/refresh;
- true SSE ordering, partial/final, abort/disconnect;
- non-streaming provider behavior;
- empty/error/evidence-only/citation rejection;
- mobile, RTL, keyboard, focus, reduced motion, dark/light;
- no research corpus persistence/copy.

### Live provider — manual/credential-gated

- model capability probe;
- generation/stream format;
- timeout/auth/quota mapping;
- usage reporting;
- grounded evaluation atas approved or explicit non-public fixture;
- zero automatic execution in ordinary CI.

## Provider contract matrix

| Scenario                  | Expected                                                |
| ------------------------- | ------------------------------------------------------- |
| Cloud success             | Normalized response/events + capability snapshot        |
| Timeout                   | `TIMEOUT`, abort transport, no secret/body log          |
| Caller abort              | `ABORTED`, no completed message                         |
| Invalid response          | `INVALID_RESPONSE`, no partial finalization             |
| Provider unavailable      | Evidence-only or explicit error per stage               |
| Tool unsupported          | Deterministic retrieval-first                           |
| Streaming supported       | Ordered normalized deltas, final event                  |
| Streaming unsupported     | Honest non-streaming completed response                 |
| Structured output invalid | Reject/retry bounded, then evidence-only                |
| Usage absent              | `unknown`, not zero                                     |
| No credentials            | Zero remote calls                                       |
| Config switch             | Same orchestrator contracts, selected capability subset |
| Embedding mismatch        | Reject before DB write/search                           |

## Religious evidence integrity tests

P0 assertions:

1. fabricated citation ID is rejected;
2. citation from prior turn not in current ledger is rejected unless explicitly
   rehydrated and revalidated;
3. altered collection/number/scheme is rejected;
4. quote not found in evidence is rejected;
5. grade without complete attribution is removed/rejected;
6. research-only evidence cannot enter public ledger;
7. empty retrieval returns limitation, not hadith text;
8. DB failure never becomes mock/evidence/generation;
9. explanation is distinguishable from original/translation;
10. correction to source invalidates verification/embedding eligibility.

Use synthetic identifiers/text for most automated tests. Real hadith text hanya
digunakan pada approved/verified corpus atau explicit local research suite dengan
no-distribution controls.

## Conversational tests

Gunakan frozen conversations dengan human-authored expected behavior, bukan exact
prose model output. Contoh categories:

- follow-up narrows prior topic;
- pronoun/ellipsis resolution;
- format request retains topic but does not truncate source misleadingly;
- explicit topic switch drops irrelevant context;
- ambiguous follow-up asks clarification;
- unsupported legal/religious conclusion returns limitation;
- context window trim keeps current request and evidence policy;
- summary never becomes citation;
- cancelled turn does not contaminate next turn;
- replay/idempotency does not duplicate messages/tool executions.

Assertions focus pada retrieval/tool selection, evidence IDs, citation validity,
status, and safety—not stylistic string equality.

## Streaming tests

- monotonically increasing sequence;
- duplicate sequence ignored;
- out-of-order/invalid serialization rejected;
- disconnect aborts provider/tool work;
- idle and total timeout distinct;
- final event exactly once;
- partial content never stored as completed;
- citation/reference event precedes or atomically accompanies committed text;
- no raw vendor fields in SSE;
- heartbeat contains no user/evidence data;
- proxy buffering headers/config verified in integration environment.

## Security tests

- production CORS HTTPS allowlist;
- localhost-only research profile cannot bind/expose publicly;
- request/body/history/evidence size limits;
- per-IP/risk-aware rate limit behavior;
- arbitrary provider URL/redirect/private metadata IP rejected;
- tool name and nested args strict validation;
- prompt injection in user text/evidence cannot bypass publication/tool policy;
- log/telemetry contains no prompt, hadith text, token, DB URL, or authorization;
- error correlation ID stable without exposing internals;
- least-privilege DB role cannot mutate corpus from runtime API.

## Retrieval quality

Pertahankan frozen calibration dan holdout terpisah. Laporkan:

- Recall@10, MRR@10, Hit@5, precision scope;
- zero-result/clarification accuracy;
- lexical/hybrid fallback frequency;
- latency p50/p95 per stage;
- judged coverage dan jumlah unjudged results;
- provider usage/cost bila tersedia;
- citation validation failure.

Fixture metrics tidak disebut kualitas hadith nyata. Qrels baru tidak ditambahkan
setelah melihat kegagalan tanpa provenance review.

## CI gates yang diusulkan

| Gate                                | Credential            | Required                             |
| ----------------------------------- | --------------------- | ------------------------------------ |
| lint/typecheck/unit/contracts/build | Tidak                 | Setiap PR                            |
| browser mock/non-stream             | Tidak                 | Setiap PR relevan                    |
| PostgreSQL isolated integration     | Test secret           | Protected/manual atau trusted branch |
| SSE proxy integration               | Staging               | Release candidate                    |
| live provider                       | Provider secret/quota | Manual only                          |
| real corpus evaluation              | Approved data access  | Release evidence gate                |

## Acceptance bar untuk klaim portability

Provider disebut interchangeable hanya jika kedua adapter lulus suite pada
capability subset yang sama. Model tanpa native tool/streaming tetap compatible
dengan fallback path, tetapi tidak boleh diberi label mendukung capability itu.

Public conversational release tidak lulus hanya karena tests teknis pass. Harus ada
approved+verified corpus, independent review, privacy/security sign-off, dan G5
evidence yang diperbarui.
