# 04 — Hadith Data Governance (P0 safety/data)

## Pengecualian development G2.6 yang diminta pengguna

Instruksi G2.6 terbaru secara eksplisit mengizinkan penelitian localhost atas
data `research_only` ketika izin publikasi belum tuntas. Sumber fawaz Bukhari
tetap research_only dan record draft; pairing otomatis bukan verified.
`APP_DATA_SCOPE=local_pilot` hanya valid dengan NODE_ENV development, loopback
dan Host localhost. Semua query/detail/sources/semantic memakai view riset
terpisah. Mode publik di bawah tetap berlaku tanpa bypass. Corpus tidak
didistribusikan, disalin lewat UI, atau dipersistenkan browser. Lihat ADR-006
dan G26_REPORT. Tidak ada persetujuan sumber otomatis atau penilaian grade.

## Non-negotiable

No LLM creates, invents, rewrites, completes or classifies hadith matn or grades. Embedding may rank **pre-existing verified rows** only. Retrieval quality and theological authority are separate matters.

## Source candidates — NOT automatically approved

- https://github.com/renomureza/hadis-api-id — nine narrators and Indonesian data. Repo MIT license **does not itself prove sublicense rights for upstream Arabic/translation** from another content owner.
- https://sunnah.com/developers — verification/reference candidate, API terms and actual permissions must be checked.
- Additional Islamic publishing authorities with clear reuse permission may be researched by agent, but no broad scraping without written permission.

## Required checks for every imported source

1. Source dataset name, raw URL, downloaded date/version/hash.
2. Ownership or permitted reuse, license URL/screenshot, restrictions on redistribution. License state `candidate|approved|rejected`.
3. Citation system and edition numbering. Source + scheme + number is unique; `'2020a'` must not be cast to integer.
4. Text Arabic exact match against documented authoritative edition, full Indonesian translation exact match against permitted translation; human spot-check or manual double check before marked verified.
5. Grade nullable, but if present store grader/attribution, source and methodology; do **not** infer grade from collection membership.
6. Raw source preserved securely for provenance; keep versioning to enable correction/reindex.

## Row-level publication rule

- `source_catalog.permission_status = 'approved'` AND `hadiths.verification_status = 'verified'`.
- Both Arabic and Indonesian text must be present and match a documented source. Unverified rows may exist as staging but **never returned by public search endpoints**.
- Content corrections trigger re-verification; invalidate/rebuild embeddings using SHA-256 content hash.
- When evidence missing: display no real results and progress blockers, not unverified text.

## Operational workflow

source candidate -> licensing research -> approval -> import to `draft` -> textual/manual verification -> mark `verified` -> indexing -> publish. A source can be rejected at any stage.

## Search UI distinction

`relevance` means similar to user query, **not** strength of hadith. Do not use fake confidence scores (e.g. 97% benar). Show grade only when verifiable and labeled with grading authority.

## Sample fixture restrictions

Mock can include e.g. card 'Hasil contoh #1', 'Kitab: contoh', 'Terjemahan: teks ilustratif' with conspicuous mock label. Do not give real Imam names + invented hadith matn, and no fake external citation links.
