# Matanexa vNext — AI Provider Design

Status: Phase 2 foundation diimplementasikan 21 Oktober 2026. Orchestration,
conversation endpoint, tool loop, dan public inference belum diimplementasikan.

## Temuan source aktual

`CloudflareEmbeddingAdapter` mempertahankan behavior concrete provider lama yang:

- memakai native `fetch` ke endpoint BGE-M3 yang hardcoded;
- memvalidasi account ID, batch 1–4, input <=12.000 karakter;
- memvalidasi response, 1024 finite non-zero dimensions, response <=1 MB;
- memakai timeout 4 detik dan normalized error codes;
- menyimpan telemetry numeric aggregate tanpa prompt/token/credential.

Behavior tersebut menjadi golden adapter pertama. `SearchService` sekarang
bergantung pada token `EMBEDDING_PROVIDER`; model/dimension berada pada kontrak
provider generik. Indexer tetap memakai concrete adapter sebagai composition root
agar count/hash/retry semantics tidak berubah.

Fondasi LLM sekarang memiliki `LlmProvider`, `CloudflareLlmAdapter`,
`MockLlmProvider`, dan `DisabledLlmProvider`. Tidak ada controller/service bisnis
yang memanggilnya. Provider default `disabled`, jadi startup dan unit tests tidak
mengirim remote inference.

## Contracts yang diimplementasikan

Contracts diletakkan di application boundary, bukan folder vendor.

```typescript
type ProviderId = string;
type ModelId = string;

interface ModelCapabilities {
  providerId: ProviderId;
  modelId: ModelId;
  contextWindow: number;
  maxOutputTokens: number;
  streaming: 'native' | 'none';
  toolCalling: 'native' | 'none';
  structuredOutput: 'schema' | 'json' | 'none';
  modalities: readonly 'text'[];
  usage: readonly ('input_tokens' | 'output_tokens' | 'total_tokens')[];
  pricing?: {
    currency: string;
    inputPerMillion?: number;
    outputPerMillion?: number;
  };
  timeoutMs: number;
  maxConcurrency: number;
  evidence: { source: string; checkedAt: string };
}

interface LlmProvider {
  readonly providerId: ProviderId;
  capabilities(modelId: ModelId): ModelCapabilities;
  generate(
    request: GenerationRequest,
    signal: AbortSignal,
  ): Promise<GenerationResponse>;
  stream?(
    request: GenerationRequest,
    signal: AbortSignal,
  ): AsyncIterable<GenerationEvent>;
}

interface EmbeddingProvider {
  readonly providerId: ProviderId;
  describe(modelId: ModelId): EmbeddingModelDescriptor;
  embed(
    request: EmbeddingRequest,
    signal: AbortSignal,
  ): Promise<EmbeddingResponse>;
}
```

Kontrak final Phase 2 menjaga:

- explicit provider/model IDs;
- AbortSignal;
- capability snapshot;
- normalized usage/error;
- tidak ada raw vendor event keluar adapter;
- tidak ada assumption bahwa `stream`, tool calling, atau JSON mode selalu ada.

## Request/response model

`GenerationRequest` berisi model-independent messages, bounded evidence ledger,
output contract, timeout budget, dan allowed tools. Ia tidak berisi URL/token SDK
vendor. `GenerationResponse` berisi normalized parts, citations requested by model,
finish reason, usage, dan provider execution ID yang aman bila tersedia.

Errors dinormalisasi:

```text
NOT_CONFIGURED
AUTHENTICATION_FAILED
RATE_LIMITED
TIMEOUT
ABORTED
UNAVAILABLE
INVALID_RESPONSE
UNSUPPORTED_CAPABILITY
POLICY_REJECTED
```

Error provider tidak boleh diubah menjadi database error. Raw response/body tidak
masuk log atau public error.

## Capability registry

Capability tidak diinferensikan dari nama model. Setiap `(providerId, modelId)`
memiliki descriptor yang berasal dari dokumentasi resmi atau contract probe yang
disimpan sebagai evidence tanggal pemeriksaan. Unknown capability adalah `none`,
bukan optimistic default.

Orchestrator memilih path:

| Capability                            | Path                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| Native tool calling + structured args | Native allowlisted tool loop                                  |
| Tanpa tool calling                    | Deterministic retrieval dahulu, lalu generation atas evidence |
| Native streaming                      | Adapter menghasilkan normalized deltas                        |
| Tanpa streaming                       | Non-streaming response; UI tidak mensimulasikan token stream  |
| Structured output schema              | Gunakan schema + validate                                     |
| JSON/none                             | Parse hanya output non-executable, validate, fail closed      |

Free-form text model tidak pernah diparse menjadi instruksi tool berisiko.

## Adapter strategy

### Phase 2

1. `CloudflareEmbeddingAdapter` berada di belakang token `EMBEDDING_PROVIDER`,
   tanpa perubahan model BGE-M3, 1024 dimensi, indexing, ranking, atau fallback.
2. `MockEmbeddingProvider` menghasilkan vector 1024 deterministik khusus test dan
   tidak diikat ke runtime production.
3. `MockLlmProvider` menghasilkan respons/event deterministik untuk contract test.
4. `CloudflareLlmAdapter` memakai native `fetch` yang dapat diinjeksi saat test,
   response limits, timeout/caller cancellation, normalized error/usage/event, dan
   telemetry tanpa raw prompt/secret.
5. `DisabledLlmProvider` adalah binding default. Tidak ada model default atau
   remote call otomatis.

### Ditunda

Adapter OpenAI-compatible, Ollama, vLLM, dan llama.cpp belum dibuat.
`OpenAiCompatibleAdapterConfig` dan static hosted/loopback URL policy memastikan
adapter tersebut dapat menjadi implementasi port yang sama. Satu
“OpenAI-compatible” label tidak menjamin streaming/tool/JSON semantics identik;
setiap endpoint tetap membutuhkan capability descriptor dan contract tests.

## Provider selection

Konfigurasi backend-only:

```dotenv
AI_LLM_PROVIDER=disabled
AI_LLM_MODEL=
AI_LLM_TIMEOUT_MS=30000
AI_LLM_MAX_CONCURRENCY=2

AI_EMBEDDING_PROVIDER=cloudflare
AI_EMBEDDING_MODEL=@cf/baai/bge-m3
AI_EMBEDDING_TIMEOUT_MS=4000
```

`AI_LLM_PROVIDER=disabled` adalah default. `cloudflare` mewajibkan account ID,
token, dan model ID `@cf/...` dari server environment. Request/domain object tidak
memiliki base URL atau token. Future base URL hanya boleh berasal dari admin
environment dan melalui hosted/loopback policy; end user tidak dapat menyetelnya.

Tidak ada automatic cross-vendor fallback. Fallback yang diperbolehkan:

- LLM unavailable -> evidence-only response;
- embedding unavailable -> existing lexical fallback;
- native stream unsupported -> non-streaming response dari provider/model sama.

## SSRF dan endpoint policy

Future custom endpoints memerlukan:

- HTTPS default; HTTP hanya loopback pada explicit self-hosted profile;
- reject username/password, fragment, unsupported port, link-local, metadata IP,
  private IP pada cloud profile, DNS rebinding result, dan redirects ke host lain;
- configured host allowlist dan resolved-address check;
- response byte/time limits;
- no arbitrary headers dari client;
- credential scope per adapter.

Cloud backend tidak boleh mencoba mengakses `localhost` milik browser pengguna.

## Usage, cost, dan privacy

Normalized telemetry per execution:

```text
correlationId, providerId, modelId, operation
startedAt, firstEventAt?, completedAt, outcome
inputTokens?, outputTokens?, totalTokens?, estimatedCost?
retryCount, timeout, capabilitySnapshotHash
```

Tidak dicatat secara default: raw prompt, conversation content, hadith text, token,
authorization header, provider response body, atau chain-of-thought. Estimated cost
hanya dihitung bila pricing descriptor memiliki sumber/tanggal; jika tidak tersedia
nilainya `unknown`, bukan nol.

## Contract test suite

Setiap adapter wajib lulus suite yang sama:

- success dan normalized metadata;
- timeout dan caller abort;
- invalid/malformed/oversized response;
- auth/rate limit/unavailable mapping;
- streaming supported/unsupported;
- tool calling supported/unsupported;
- structured output validation;
- usage absent/present;
- secret/prompt tidak masuk error/telemetry;
- concurrency limit;
- embedding count/dimensions/finite/nonzero;
- configuration switch tanpa perubahan orchestration.

Klaim interchangeability hanya berlaku pada capability subset yang lulus tests,
bukan pada semua fitur provider.

Phase 2 menguji generate normal, native stream yang dinormalisasi, capability
rejection, timeout, caller abort, malformed response, HTTP error mapping,
configuration bounds, deterministic mock, telemetry redaction, embedding
descriptor, dan hosted/loopback endpoint policy. Live Cloudflare test berada pada
script terpisah, memerlukan `RUN_LIVE_CLOUDFLARE_LLM=1` serta batas token 1–32;
status pekerjaan ini NOT RUN.
