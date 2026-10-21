# Matanexa vNext — Conversational Engine Design

Status: backend orchestration foundation diimplementasikan pada Phase 4. Phase 5
menambahkan API v2 internal default-disabled dan normalized buffered-validated SSE.
Frontend, API publik, persistence, dan provider-native answer streaming belum
diimplementasikan.

## Prinsip

Conversational engine memahami follow-up melalui bounded conversation history dan
tool evidence, bukan keyword/regex/if-else intent mapping. Lexical rules saat ini
tetap digunakan untuk retrieval fallback, bukan untuk memutuskan maksud multi-turn.

Generation adalah lapisan penjelasan di atas evidence. Ia tidak membuat sumber,
nomor, matn, terjemahan, grade, atau status verifikasi.

## Message schema independen provider

```typescript
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
type MessageStatus =
  'pending' | 'running' | 'completed' | 'aborted' | 'failed' | 'rejected';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'reference'; evidenceId: string }
  | {
      type: 'tool_request';
      executionId: string;
      toolName: string;
      args: unknown;
    }
  | { type: 'tool_result'; executionId: string; summary: unknown };

interface Message {
  id: string;
  conversationId: string;
  parentMessageId?: string;
  role: MessageRole;
  status: MessageStatus;
  parts: ContentPart[];
  createdAt: string;
}
```

System instructions dan internal planner state tidak berasal dari client. Chain of
thought tidak disimpan. Tool result persisten hanya summary/reference IDs yang aman,
bukan raw database/provider payload.

## Conversation turn state machine

```text
accepted
  -> contextualizing
  -> planning
  -> retrieving
  -> selecting_evidence
  -> generating
  -> validating_citations
  -> completed

Any active state -> aborted | failed | evidence_only
```

Status internal dipetakan ke normalized UI events. User-facing copy tidak boleh
mengklaim tahap yang tidak benar-benar terjadi.

## Orchestration algorithm

1. Validasi request, schema version, message order, total bytes, dan idempotency.
2. Terapkan privacy/data-scope policy sebelum provider call.
3. Pilih context: system policy + bounded recent messages + optional summary +
   message terbaru. Jangan mempercayai tool/system roles dari client.
4. Jika provider memiliki native tool calling, izinkan hanya tools read-only yang
   terdaftar. Jika tidak, lakukan deterministic retrieval-first.
5. Jalankan search dengan query reformulation yang dihasilkan model hanya sebagai
   search input; jangan jadikan hasil model sebagai hadith fact.
6. Ambil details untuk kandidat terpilih dan buat immutable evidence ledger.
7. Jika ledger kosong, jawab keterbatasan tanpa citation buatan.
8. Generate explanation dengan aturan evidence-only.
9. Validasi output dan semua citation IDs.
10. Emit completed response atau evidence-only fallback.

Jumlah tool round dibatasi (usulan awal: maksimal 3 execution/turn), timeout total
dibagi per stage, dan repeated identical calls didedup.

## Follow-up dan topic continuity

Message seperti “kalau khusus ibu?” dipahami dari conversation history yang dikirim
ke provider/orchestrator. Query reformulation dapat menghasilkan search query baru,
misalnya konteks orang tua + batas ibu, tetapi reformulation tidak ditampilkan
sebagai kutipan atau disimpan sebagai religious fact.

Topic switching ditangani model dan evidence outcome, bukan daftar phrase. Jika
confidence/structured plan invalid, fallback aman adalah mencari message terbaru
sebagai query independen atau meminta klarifikasi; pilihan dicatat di metadata.

Permintaan format seperti “yang pendek buat status WA” boleh memengaruhi panjang
penjelasan/pilihan evidence, tetapi tidak boleh memotong teks lalu menyajikannya
sebagai matn utuh. UI harus membedakan excerpt dari full hadith.

## Evidence ledger dan citation integrity

```typescript
interface EvidenceItem {
  evidenceId: string;
  hadithId: string;
  scope: 'published' | 'local_research';
  citation: { collection: string; number: string; numberingScheme: string };
  arabicText: string;
  indonesianText: string;
  provenance: ProvenanceSnapshot;
  verification: VerificationSnapshot;
}
```

Public policy menerima hanya `published`. `local_research` hanya dapat tampil pada
explicit development research profile dengan label/no-store/copy restrictions yang
sudah ada dan tidak boleh dikirim ke public endpoint.

Validator memeriksa:

- setiap `evidenceId` berasal dari turn yang sama;
- identifier/citation snapshot tidak diubah model;
- quote, bila ada, adalah exact normalized substring evidence yang tepat;
- grade hanya muncul bila seluruh grade attribution tersedia pada evidence;
- output tidak menyebut reference ID/URL di luar ledger;
- explanation dilabeli sebagai penjelasan AI, terpisah dari kutipan.

Invalid output tidak “diperbaiki” dengan menebak citation. Response model dibuang,
lalu sistem mengirim evidence cards dan keterbatasan.

## Streaming contract

Pipeline:

```text
Provider/native response
  -> adapter-normalized GenerationEvent
  -> orchestration policy/citation buffer
  -> NestJS SSE serializer
  -> web event reducer
```

Event minimum:

```typescript
type ConversationEvent =
  | { seq: number; type: 'message_started'; messageId: string }
  | { seq: number; type: 'status'; stage: SafeStage }
  | { seq: number; type: 'text_delta'; delta: string }
  | { seq: number; type: 'tool_started'; executionId: string; toolName: string }
  | { seq: number; type: 'tool_completed'; executionId: string }
  | { seq: number; type: 'reference_added'; reference: MessageReference }
  | { seq: number; type: 'message_completed'; message: AssistantMessage }
  | { seq: number; type: 'error'; error: PublicError };
```

Raw provider event tidak keluar adapter. `seq` monotonik per turn membantu duplicate
protection. Citation-dependent text dapat ditahan sampai validation atau dikirim
sebagai uncommitted draft yang tidak dapat disalin; pilihan pertama lebih aman untuk
versi awal.

SSE requirements:

- `Content-Type: text/event-stream`, `no-store`, buffering disabled;
- heartbeat hanya bila proxy timeout membutuhkannya;
- disconnect memicu AbortController dan provider cancel jika didukung;
- total/idle timeout berbeda;
- final event selalu completed/error/aborted;
- client reducer idempotent terhadap seq duplikat;
- partial text ditandai incomplete dan tidak disimpan sebagai final answer.

Provider tanpa streaming menjalankan generation penuh lalu mengirim
`message_started`, references, `message_completed`; UI tidak membuat fake token
typing.

## Context budgeting dan summary

Budget dihitung dari capability descriptor dan estimator yang konservatif:

```text
system policy
+ output reserve
+ tool schema reserve
+ evidence budget
+ recent conversation budget
<= provider context window
```

Summarization hanya dilakukan bila history tidak muat dan provider/config policy
mengizinkan. Summary adalah context aid, bukan evidence agama. Ia disimpan terpisah,
berversi, dan tidak boleh menggantikan source citations. Jika usage tokenizer tidak
tersedia, gunakan conservative character/byte estimator dan margin.

## localStorage compatibility

Key tetap `matanexa.workspace.v1`. Reader baru mengenali dua bentuk:

1. legacy `WorkspaceData` dengan history query snapshots;
2. envelope `{schemaVersion: 2, conversations, saved, preferences}`.

Migrasi dilakukan in-memory setelah validasi. Legacy entry menjadi conversation
dengan satu user message dan satu assistant evidence-results message; tidak
direinterpretasi sebagai generated answer. Research-only data tetap dibuang.

Write strategy yang diusulkan adalah single-write v2 setelah migration berhasil,
dengan backup bounded dari raw legacy value hanya untuk satu sesi rollback. Sebelum
implementasi, test harus membuktikan corrupt/oversized/unavailable storage tetap
tidak memblokir aplikasi.

## Persistence decision

Tanpa login, server-side conversation persistence belum dibutuhkan dan menambah
privacy/ownership complexity. Fase awal menyimpan conversation di browser dan
mengirim bounded context per request. PostgreSQL entity design disiapkan tetapi
tidak dibuat sampai ada use case seperti multi-device, shared link, atau recovery
yang disetujui.

## Error recovery

| Failure               | Behavior                                                               |
| --------------------- | ---------------------------------------------------------------------- |
| Retrieval DB gagal    | Error jelas; tidak ada fake evidence/jawaban                           |
| Embedding gagal       | Lexical fallback dengan mode jujur                                     |
| LLM gagal             | Evidence-only response bila retrieval berhasil                         |
| Citation invalid      | Buang generated answer; evidence-only                                  |
| Stream putus          | Mark partial/aborted; retry membuat turn baru/idempotent resume policy |
| Tool args invalid     | Reject tool call; maksimal satu constrained replan bila budget ada     |
| Context terlalu besar | Trim/summarize sesuai policy atau minta user mempersempit              |
