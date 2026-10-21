# Matanexa vNext — Target Architecture

Status: blueprint `Proposed`, belum menjadi kontrak runtime. Tanggal: 21 Oktober 2026. Implementasi memerlukan persetujuan pengguna setelah Phase 0.

## Tujuan dan guardrail

Target adalah modular monolith yang menambahkan percakapan dan grounded generation
tanpa mengganti Next.js, NestJS, PostgreSQL/pgvector, `pg`, atau npm workspaces.
Extension point dibuat hanya pada dua sisi yang benar-benar berubah: provider AI
dan retrieval storage/orchestration.

Guardrail absolut:

1. model tidak pernah menjadi sumber teks/nomor/grade hadits;
2. hanya evidence dari publication boundary yang dapat dipakai pada public mode;
3. research-only evidence tidak boleh masuk public answer;
4. citation yang tidak dapat divalidasi membuat generation ditolak;
5. deployment, billing, dan local model tetap tidak dilakukan pada fase ini;
6. API v1 tetap berjalan selama migrasi;
7. default tanpa credential harus tetap mock/lexical-safe.

## Konflik kontrak yang harus diputuskan

`AGENTS.md`, ADR-001, dan ADR-003 menetapkan bahwa chat UI bukan LLM, query selalu
independen, streaming tidak diperlukan, dan deployment ditunda. Blueprint vNext
tidak mengubah dokumen aktif tersebut. ADR-007–009 dibuat berstatus `Proposed`.
Jika disetujui, fase implementasi pertama harus memperbarui kontrak proyek secara
eksplisit dan menentukan bagian ADR lama yang disupersede; integritas data dan
larangan deployment tidak otomatis berubah.

## Bentuk modular monolith

```text
apps/web
  UI conversation, state, HTTP/SSE client, localStorage migration
        |
        | API v1 JSON + API v2 JSON/SSE
        v
apps/api
  modules/
    conversations/  application state machine + DTO
    ai/             orchestration, evidence ledger, citation validation
    search/         existing search use cases and retrieval facade
    hadiths/        immutable evidence serialization
    sources/        source/provenance read models
  infrastructure/
    llm/            provider adapters + registry
    embeddings/     provider adapters + registry
    persistence/    pg repositories and optional conversation repository
    telemetry/      provider-independent execution metrics
        |
        v
PostgreSQL/pgvector + configured hosted AI providers

packages/contracts
  pure TypeScript/Zod serialization contracts; no Nest/React/ORM imports
```

Target path bersifat konseptual. Existing file tidak dipindahkan sampai ada alasan
yang diuji. Sebagai contoh, `DatabaseService` dapat tetap di `src/database` pada
fase awal sementara token/interface baru diperkenalkan.

## Dependency rules

- Controller bergantung pada application service, tidak pada provider/SQL.
- Conversation orchestrator bergantung pada `LLMProvider`, `RetrievalGateway`,
  `EvidencePolicy`, `CitationValidator`, dan telemetry ports.
- Provider adapters boleh bergantung pada `fetch` dan format vendor; domain tidak.
- PostgreSQL repositories mengimplementasikan retrieval/persistence ports.
- Hadith/source domain tidak boleh bergantung pada AI.
- Web hanya bergantung pada serialized contracts dan browser APIs.
- `packages/contracts` tidak memiliki dependency ke NestJS, React, `pg`, atau ORM.

## Use-case flow

```text
POST message
  -> validate request + correlation/idempotency key
  -> load/validate client-supplied conversation context
  -> budget context
  -> plan using model capability OR deterministic retrieval-first path
  -> execute allowlisted retrieval tool
  -> apply publication/research policy
  -> build immutable evidence ledger
  -> generate explanation grounded only in ledger
  -> validate every citation/evidence ID
  -> emit completed answer OR evidence-only response
```

LLM planning tidak diberi arbitrary SQL, URL, atau tool execution. Tool awal hanya
read-only: search evidence dan lookup detail/source. Tool args memakai schema ketat,
jumlah execution dibatasi, dan hasil melewati policy yang sama dengan API v1.

## Proposed module responsibilities

### `conversations`

- model-independent messages dan conversation metadata;
- context selection/budget, cancellation, status transitions;
- legacy `matanexa.workspace.v1` migration contract;
- tidak menyimpan chain-of-thought atau raw provider payload;
- server persistence bersifat optional sampai ada kebutuhan tanpa login yang jelas.

### `ai`

- provider selection berdasarkan konfigurasi admin;
- capability-aware execution;
- retrieval-first orchestration;
- evidence ledger dan grounded prompt construction;
- citation/reference validation;
- normalized event production;
- fallback hanya dalam provider yang sama bila kebijakannya eksplisit; tidak ada
  cross-vendor automatic fallback.

### `search`

- mempertahankan endpoint dan semantics v1;
- mengekspos `RetrievalGateway` untuk lexical/semantic/hybrid;
- query analyzer lama tetap lexical component, bukan conversation router;
- storage-specific SQL tetap di adapter PostgreSQL.

### `hadiths` dan `sources`

- mempertahankan publication boundary dan provenance;
- menyediakan immutable evidence snapshot untuk satu execution;
- tidak menerima mutation/verifikasi dari orchestration atau provider.

### `infrastructure`

- adapter Cloudflare embedding yang membungkus behavior saat ini;
- Cloudflare LLM adapter setelah model/capabilities diverifikasi;
- mock adapters untuk test;
- optional OpenAI-compatible adapter hanya setelah kebutuhan dan risiko SSRF/
  privacy disetujui;
- PostgreSQL, telemetry sink, clock/ID generator sebagai adapters bila diperlukan.

## Contract evolution

API v1 dipertahankan:

- `POST /api/v1/search`
- `GET /api/v1/hadiths/:id`
- `GET /api/v1/sources`
- `GET /api/v1/health`

API v2 yang diusulkan:

| Endpoint                                         | Peran                                                        |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `POST /api/v2/conversations/:id/messages`        | Non-streaming grounded turn                                  |
| `POST /api/v2/conversations/:id/messages:stream` | SSE normalized events                                        |
| `POST /api/v2/conversations/:id/cancel`          | Opsional jika abort koneksi tidak cukup                      |
| `GET /api/v2/capabilities`                       | Public-safe UI capabilities, tanpa secret/provider internals |

Conversation history dapat dikirim sebagai bounded client state pada tahap awal.
Ini menghindari database persistence dan account model prematur. Server harus
memvalidasi ukuran, role, urutan, schemaVersion, dan mengabaikan message/provider
metadata yang tidak dipercaya dari client.

## Data model konseptual

```text
Conversation
  id, schemaVersion, createdAt, updatedAt, title?, status, privacyMode

Message
  id, conversationId, role, status, contentParts[], createdAt, parentMessageId?

MessageReference
  messageId, evidenceId, hadithId, citationSnapshot, displayRange?

ToolExecution
  id, messageId, toolName, validatedArgs, status, startedAt, completedAt

ModelExecutionMetadata
  providerId, modelId, capabilitySnapshot, latency, tokenUsage?, costEstimate?
```

`contentParts` hanya menyimpan public/user-visible content atau tool summaries yang
aman. System prompt, chain-of-thought, bearer token, headers, dan raw vendor payload
tidak dipersistenkan.

## Evidence integrity architecture

Setiap retrieval menghasilkan `EvidenceItem` dengan opaque `evidenceId`, database
`hadithId`, text snapshot, citation snapshot, provenance, permission status,
verification status, dan scope. Prompt hanya boleh merujuk evidence ID tersebut.

Output terstruktur minimal:

```json
{
  "answerParts": [{ "type": "text", "text": "..." }],
  "citations": [{ "evidenceId": "ev_..." }],
  "limitations": []
}
```

Validator memastikan setiap ID ada dalam ledger, scope diizinkan, dan kutipan
verbatim cocok dengan evidence bila model menghasilkan kutipan. Gagal validasi:
tidak mengirim draft model; kembalikan evidence-only result atau safe limitation.

## Runtime profiles

| Profile              | Listen/CORS                              | Data           | AI                                |
| -------------------- | ---------------------------------------- | -------------- | --------------------------------- |
| `local` default      | loopback + localhost                     | mock/published | off atau credentialed cloud       |
| `local_research`     | loopback + Host guard/no-store           | research-only  | explicit opt-in                   |
| `cloud` future       | configured host + HTTPS origin allowlist | published only | configured hosted provider        |
| `self_hosted` future | admin config                             | published only | compatible adapter, never default |

Profile harus eksplisit; `NODE_ENV` saja tidak cukup untuk menyatakan kebijakan.

## Non-goals awal

- tidak ada microservice, Redis, broker, LangChain/LlamaIndex, ORM, GraphQL;
- tidak ada server conversation persistence sebelum ada kebutuhan/account policy;
- tidak ada arbitrary provider URL dari end user;
- tidak ada provider auto-fallback lintas vendor;
- tidak ada tool yang menulis database/corpus;
- tidak ada deployment atau billing activation;
- tidak ada local model download/run.

## Acceptance architecture

Blueprint dianggap siap diimplementasikan hanya bila:

- ADR proposed disetujui atau direvisi pengguna;
- data/publication gates tetap eksplisit;
- API v1 compatibility dan localStorage migration disepakati;
- provider/model cloud awal beserta capability evidence dipilih;
- privacy policy untuk history yang dikirim ke provider disetujui;
- setiap fase mempunyai contract tests dan rollback;
- tidak ada requirement deployment yang melompati G5/local sign-off.
