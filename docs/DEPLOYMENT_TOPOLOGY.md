# Matanexa vNext — Deployment Topology

Status: target topology saja. Tidak ada deployment, cloud resource, billing, atau
configuration production yang dibuat pada Phase 0. Gate G6 tetap tertunda.

## Readiness aktual

Source saat ini belum deploy-ready:

- Nest bind hardcoded ke `127.0.0.1` dan log menyebut API lokal;
- CORS validator hanya menerima `http://localhost|127.0.0.1:<port>`;
- DB connection hanya menerima hostname `*.neon.tech`;
- tidak ada `.github/workflows`, Cloudflare Pages config, atau Render config;
- tidak ada production security profile, readiness check, rate limit, atau rollout;
- Next `/` terdeteksi statis oleh build, tetapi tidak ada explicit static export/
  Cloudflare Pages configuration;
- public corpus masih kosong sehingga production content gate belum lulus.

## A. Cloud mode — target prioritas

```text
Browser
  -> Cloudflare Pages: static/client Next.js output
       -> HTTPS/SSE
          -> Render-compatible Node host: NestJS
               -> Neon PostgreSQL/pgvector
               -> Cloudflare Workers AI hosted APIs
```

Frontend dan backend dibangun/deploy independen. Browser hanya menerima public API
base URL. Semua database/provider credentials berada di backend secret store.

Sebelum memilih adapter Cloudflare Pages, lakukan compatibility spike terhadap
Next version aktual dan kebutuhan runtime aktual. Karena halaman saat ini client-
only dan statis, pure static artifact adalah arah sederhana, tetapi keputusan
`output: export` tidak dibuat pada audit ini dan tidak boleh mengorbankan fitur.

### Cloud environment categories

| Kategori       | Web                          | API                                 |
| -------------- | ---------------------------- | ----------------------------------- |
| Public config  | API base URL, build revision | public origin, release revision     |
| Secrets        | tidak ada                    | DB URL, provider tokens             |
| Runtime policy | static assets/CSP            | cloud profile, published scope only |
| Scaling        | CDN                          | bounded Node instances/concurrency  |
| Health         | asset availability           | liveness + readiness terpisah       |

Cloud mode wajib memaksa `APP_DATA_SCOPE=published`; `local_pilot` harus ditolak
bahkan bila environment salah konfigurasi.

## B. Hybrid mode — future

```text
Cloud web/API/database
  -> authenticated HTTPS/private network
     -> dedicated/private inference endpoint
```

Cloud backend tidak dapat mengakses `localhost` pengguna. Private endpoint harus
memiliki routable address, TLS/authentication, endpoint allowlist, timeout, dan
privacy policy. Tidak ada browser-to-model direct connection.

## C. Self-hosted mode — future

```text
Reverse proxy/TLS
  -> Next static/server host
  -> NestJS
      -> PostgreSQL/pgvector
      -> configured local inference service
```

Self-hosted tidak berarti insecure default. Admin tetap memilih provider/model,
network policy, secrets, DB role, retention, dan publication scope. Ollama/vLLM/
llama.cpp hanya adapters masa depan; tidak diunduh atau dijalankan sekarang.

## Environment profile design

Usulan:

```dotenv
APP_RUNTIME_PROFILE=local
APP_BIND_HOST=127.0.0.1
APP_PUBLIC_ORIGINS=http://localhost:3000
APP_DATA_SCOPE=published
APP_SEARCH_MODE=mock
```

Allowed combinations divalidasi sebagai schema, bukan conditional tersebar:

- local: loopback, localhost HTTP origin allowed;
- local_research: development + loopback + local Host + no-store;
- cloud: non-loopback allowed, HTTPS origins only, published only;
- self_hosted: explicit admin allowlist; insecure HTTP hanya opt-in private setup.

## Independent build/CI target

Workflow future, belum dibuat:

1. `validate-shared`: contract schema, migrations, lint/typecheck common.
2. `validate-web`: web lint/typecheck/test/build bila web/contracts berubah.
3. `validate-api`: API lint/typecheck/unit/build bila API/contracts/db berubah.
4. `integration-db`: manual/protected job dengan ephemeral test branch/schema.
5. `live-provider`: manual only, protected secrets, quota guard.
6. `e2e`: deploy preview atau local artifact pair; no research corpus artifact.

Path-aware execution menghemat waktu, tetapi perubahan `contracts`, root lockfile,
DB migrations, atau shared config memicu kedua workspace.

## Staging strategy

- environment/DB branch/credentials terpisah dari production;
- hanya approved+verified test/published corpus;
- synthetic fixtures tetap jelas dan tidak masuk publication view;
- provider quota/budget caps dan no automatic paid upgrade;
- release revision tersedia pada health/telemetry tanpa secret;
- migration dijalankan sebagai explicit release step, bukan app startup;
- smoke test dilakukan sebelum traffic switch.

## Rollback strategy

- immutable frontend/API artifacts per Git SHA;
- deploy API yang kompatibel dengan current dan next contract selama migration;
- additive DB migration; application rollback tidak memerlukan schema rollback;
- embedding collection activation berupa config/DB pointer atomic;
- provider config rollback tanpa cross-vendor automatic failover;
- jangan rollback content correction dengan memulihkan row yang sudah tidak verified.

## Deployment blockers

1. public corpus permission/verification dan independent review;
2. G5 local sign-off belum lulus;
3. accepted vNext ADR/contracts belum ada;
4. production CORS/listen/env/security belum diimplementasikan;
5. rate limit, request limits, CSP/security headers, correlation/telemetry belum ada;
6. CI/deployment artifacts belum ada;
7. privacy/retention/provider data policy belum disetujui;
8. provider LLM/model/capabilities/cost belum dipilih dan diuji;
9. Cloudflare Pages compatibility belum diverifikasi pada source aktual.

Tidak satu pun blocker ini boleh dilewati oleh automation.
