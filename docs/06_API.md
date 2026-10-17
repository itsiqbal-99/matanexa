# 06 — NestJS API Contract (v1)

Base: `http://localhost:4000/api/v1`. Machine-readable schema: `contracts/openapi.yaml`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | App alive, mode, no secrets |
| GET | `/sources` | Approved collections with verified records |
| POST | `/search` | Text query; optional source filter and page/limit |
| GET | `/hadiths/:id` | Full text, citation, provenance of verified hadith |

## POST /search
Request:
```json
{"query":"hadits tentang makan dengan tangan kanan","filters":{"sourceSlugs":["bukhari","muslim"]},"page":1,"limit":10}
```
Success response:
```json
{
  "data": {
    "results": [{
      "id":"<uuid-from-database>",
      "title":"<verified-title-or-book-name>",
      "excerpt":"<substring-of-approved-Indonesian-translation>",
      "citation":{"collection":"<verified-collection>","number":"<source-number-as-string>","numberingScheme":"<verified-edition>"},
      "referenceUrl":"https://<actual-source-url>"
    }],
    "totalCandidates": 0
  },
  "meta":{"page":1,"limit":10,"hasMore":false,"modeUsed":"lexical","requestId":"<generated-id>"}
}
```
Angle bracket values here are **field descriptions**, not real references or valid URLs, and must be replaced from DB only.

## GET /hadiths/:id
Includes `arabicText`, `indonesianText`, `collection`, `bookName`, `chapterName?`, `narrator?`, `hadithNumber`, `numberingScheme`, `referenceUrl`, `grade?`, `grader?`, `gradeSourceUrl?`; missing optional grading is omitted, not forged.

## Validation / errors
- Query 3–300 codepoints after trimming; rejected returns 400 `VALIDATION_ERROR`.
- Unknown source slug => empty valid results or validated bad request, choose and document; no raw DB stack traces.
- Rate limit per IP when possible; 408/503 for provider timeout, 503 for DB unavailable.
- `error` shape `{error:{code,message,requestId}}`. No secrets in logs.
- `modeUsed`: `mock`, `lexical`, `hybrid`, `lexical_fallback`. Never claim hybrid when fallback occurred.
- CORS allow `http://localhost:3000` and `http://127.0.0.1:3000` by default.
