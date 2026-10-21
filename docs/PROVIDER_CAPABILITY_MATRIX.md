# Matanexa vNext — Provider Capability Matrix

Checked: 21 October 2026  
Scope: Phase 2 foundation only

Unknown capability always means unsupported. A check in this table means the
adapter contract is implemented and tested; it does not authorize public use.

| Provider/model                                  | Generate            | Stream                          | Tools                | Structured output    | Usage                            | Runtime status                                                 |
| ----------------------------------------------- | ------------------- | ------------------------------- | -------------------- | -------------------- | -------------------------------- | -------------------------------------------------------------- |
| Cloudflare `@cf/baai/bge-m3`                    | N/A                 | N/A                             | N/A                  | N/A                  | Numeric fields when returned     | Existing embedding adapter; 1024 dimensions unchanged          |
| Cloudflare `@cf/meta/llama-3.1-8b-instruct-fp8` | Yes                 | Native SSE normalized           | None                 | None                 | Optional normalized token counts | Adapter available; disabled and not connected to business flow |
| Cloudflare configurable unknown `@cf/...` model | Basic generate only | None until verified             | None                 | None                 | Optional                         | Fail-closed capability descriptor                              |
| Mock `mock-deterministic-v1`                    | Yes                 | Deterministic normalized events | None                 | JSON object          | Deterministic token counts       | Automated tests only                                           |
| Disabled provider                               | No                  | No                              | No                   | No                   | No                               | Default runtime binding                                        |
| Future OpenAI-compatible hosted/loopback        | Port ready          | Descriptor-dependent            | Descriptor-dependent | Descriptor-dependent | Descriptor-dependent             | No adapter and no local model installed                        |

## Validation rules

- Streaming requests are rejected before transport unless descriptor value is
  `native`.
- Tool requests are rejected unless value is `native`.
- `json_schema` and `json_object` requests are checked independently; support is
  never inferred from an OpenAI-compatible label.
- A model ID must equal the backend-configured model. No request may supply a URL,
  token, provider switch, or capability override.
- Hosted future endpoints require HTTPS and reject loopback/private/link-local
  literal addresses. Self-hosted endpoints are limited to explicit HTTP loopback
  profile. DNS resolution/rebinding checks remain a production-hardening task.

## Evidence and limits

The Cloudflare REST envelope and model input/output follow the official Workers AI
REST/model documentation:

- <https://developers.cloudflare.com/workers-ai/get-started/rest-api/>
- <https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/>
- <https://developers.cloudflare.com/api/resources/ai/methods/run/>

The verified descriptor intentionally advertises neither tools nor structured
output. Cloudflare documents those features per model, and JSON mode may be
incompatible with streaming; no optimistic capability is enabled. Live inference
was NOT RUN because the explicit opt-in gate was not set. Credential availability
was not printed or inferred.
