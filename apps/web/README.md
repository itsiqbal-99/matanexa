# Matanexa — Quiet Intelligence v1.1

Next.js 16 + React 19 + TypeScript strict + Tailwind CSS 4. Redesigned chat-first search workspace with the **Senja** color system, editorial reference results, responsive sidebar, adaptive text reveal, and request-driven loading states.

## Getting started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL` in `.env.local` to the public NestJS API URL. Run the NestJS backend separately. This frontend does not perform local matching, access a database, expose Next API routes, or fabricate a generative model response.

### Validation

```bash
npm run test:smoke
npm run lint
npm run typecheck
npm run build
```

If using the parent monorepo, run the relevant commands with `--workspace @matanexa/web`. The E2E tests mentioned in the original README belong to the parent monorepo and are not included in this frontend-only ZIP.

## Preserved behavior

- `POST /api/v1/search` and all request/response contracts, error/timeout/abort handling, and runtime response validation remain unchanged.
- Search queries are independent, **not** a generative multi-turn conversation. The summary is factual text composed from API metadata only.
- Source filters and pagination preserve prior results while the next request is in flight. Older requests cannot overwrite the latest request.
- Local storage key remains `matanexa.workspace.v1`, with caps of 20 history entries and 100 saved results. Read and write validation restrictions are maintained.
- Pilot-research data is not permanently stored or copied. Mock records remain explicitly labeled non-verified and contain no invented Arabic text or grades.
- Arabic text is rendered verbatim, never character-by-character animated.

## Motion implementation

Premium-fluid CSS transitions, native React state coordination, staggered result reveals, accessible reduced-motion behavior, and word-reveal for fresh short summaries. Animation never delays the actual API lifecycle. **No new dependency was introduced**; production installs remain the same as the original package. The originally proposed Motion for React dependency can be considered separately if browser testing demonstrates a need for shared-layout transitions beyond the current CSS architecture.

## Files changed

- `app/globals.css` — visual tokens, design system, responsive layout, motion presets.
- `features/search/search-workspace.tsx`, `sidebar.tsx`, `composer.tsx`, `search-results.tsx`, `search-activity.tsx`, `result-card.tsx` — redesigned presentation.
- `features/search/use-workspace.ts` — preserved prior results and fresh-answer reveal trigger.
- `features/search/use-search-presentation.ts`, `adaptive-text-reveal.tsx` — new transient reveal logic.
- `components/modal.tsx` — panel variant for details.

## Important

The source package intentionally contains **no** `.env.local`, credentials, build cache, or installed dependencies. Copy `.env.local.example` and supply your own non-secret public API base URL.

See `QA_REPORT.md` for actual verification results and remaining predeployment checks.
