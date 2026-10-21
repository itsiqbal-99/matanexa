# Matanexa vNext — Cloud-to-Local Migration Strategy

Status: future strategy; local/self-hosted inference tidak dijalankan atau diunduh.

## Sasaran

Memindahkan inference dari hosted cloud ke self-hosted/local-compatible service
tanpa menulis ulang conversation engine, retrieval orchestration, frontend, atau
core evidence policy. Portability berlaku pada kontrak/capability subset yang
teruji, bukan janji bahwa seluruh model berperilaku identik.

## Prasyarat arsitektur

- model-independent message/event schema sudah aktif;
- provider adapter dan capability registry sudah digunakan;
- evidence/citation validator berada di orchestration, bukan adapter;
- endpoint hanya admin-configured;
- provider-independent telemetry dan contract tests tersedia;
- embedding collections versioned;
- API/web tidak mengenal vendor payload.

## Jalur migrasi LLM

### 1. Inventory current cloud behavior

Bekukan capability descriptor, prompt policy version, test corpus, expected tool
calls, citation behavior, latency, token usage, dan failure modes. Jangan memakai
raw production conversations tanpa consent/redaction.

### 2. Add compatible adapter behind disabled config

Implementasikan satu adapter untuk endpoint yang dipilih (misalnya
OpenAI-compatible/vLLM/Ollama-compatible). Ia tetap disabled dan tidak menjadi
default. Endpoint cloud profile harus menolak localhost/private address.

### 3. Run offline contract tests

Uji schema, abort, timeout, streaming, tool support, structured output, malformed
responses, citation hallucination, dan secret-safe errors. Unsupported capability
ditandai `none`, bukan diemulasi secara tidak jujur.

### 4. Shadow evaluation tanpa user traffic

Gunakan curated non-sensitive evaluation prompts dan evidence fixture. Bandingkan
groundedness/citation validity/latency, bukan hanya style. Jangan menjalankan paid
GPU/resource tanpa persetujuan.

### 5. Explicit configuration cutover

Ubah provider/model melalui admin environment pada staging/self-hosted profile.
Tidak ada per-request end-user provider URL. Retain previous config untuk rollback.

### 6. Observe dan rollback

Pantau citation validation failure, provider error, time to first event, abort, dan
tool count. Rollback adalah config switch ke provider sebelumnya, bukan automatic
cross-vendor fallback pada request aktif.

## Jalur migrasi embedding

Embedding membutuhkan reindex penuh; vector lama dan baru tidak dicampur.

```text
create BUILDING collection
  -> index eligible evidence with new model/version/dimension
  -> verify count/hash/dimension
  -> evaluate retrieval A/B on frozen judgments
  -> activate new collection atomically
  -> retain old collection for rollback
```

Jika local embedding tidak memiliki dimensi 1024, gunakan storage collection yang
sesuai. Jangan pad/truncate vectors agar terlihat kompatibel. Retrieval query selalu
memilih satu collection/model version.

## Topology realities

| API location | Inference location            | Valid?                 | Requirement                                 |
| ------------ | ----------------------------- | ---------------------- | ------------------------------------------- |
| Cloud        | Laptop user `localhost`       | Tidak                  | Localhost mengacu ke host cloud, bukan user |
| Cloud        | Private GPU endpoint          | Ya                     | Routable authenticated TLS/private network  |
| Self-hosted  | Service di host/LAN yang sama | Ya                     | Explicit allowlist/auth/network isolation   |
| Browser      | Local/cloud model langsung    | Tidak untuk desain ini | Secret/policy tetap di NestJS               |

## Data/privacy migration

- tentukan apakah conversation/evidence meninggalkan host;
- document retention dan logging model server;
- disable raw prompt logs secara default;
- pastikan model server tidak menyimpan training data tanpa kebijakan;
- rotate/revoke cloud credentials setelah cutover hanya bila rollback window selesai;
- conversation format tidak berubah karena provider switch.

## Capability downgrade behavior

- tanpa tool calling: deterministic retrieval-first;
- tanpa streaming: honest non-streaming UI;
- tanpa structured output: validate non-executable JSON/text; fail closed;
- tanpa usage metrics: telemetry `unknown`;
- context lebih kecil: tighter history/evidence budget atau clarification;
- citation quality gagal: evidence-only response.

## Exit criteria

- adapter contract suite lulus;
- grounded/citation evaluation memenuhi threshold yang disepakati;
- no research-only/public leakage;
- model/version/dimension dan prompt policy terdokumentasi;
- rollback provider dan embedding collection terbukti;
- biaya/resource/operasional disetujui pengguna;
- tidak ada perubahan frontend/business logic khusus vendor.
