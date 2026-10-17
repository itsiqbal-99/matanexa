# Matanexa v1.1 — QA Handover

## Scope

Frontend-only redesign based on the supplied `matanexa.zip`. This archive does not contain the NestJS backend, full monorepo, original E2E suite, or a usable `node_modules` directory.

## Verified here

| Check | Result | Evidence |
|---|---|---|
| TypeScript/TSX syntax parse | PASS | All 15 application TS/TSX modules transpile without syntax diagnostics using global TypeScript |
| CSS parse | PASS | PostCSS parses the new CSS stylesheet |
| API payload validator, simulation labeling | PASS | `npm run test:smoke` |
| API request contract (`POST /search`, page/limit/optional filters) | PASS | `npm run test:smoke` with mock `fetch` |
| `matanexa.workspace.v1`, history/saved caps, pilot persistence restriction | PASS | `npm run test:smoke` |
| API client file unchanged | PASS | SHA-256 identical to user-provided ZIP |
| Type declarations file unchanged | PASS | SHA-256 identical to user-provided ZIP |
| Local storage module unchanged | PASS | SHA-256 identical to user-provided ZIP |
| User environment/credentials included in deliverable | PASS — excluded | `.env.local` excluded from the new ZIP; `.env.local.example` included |

## Not verified in this environment

- `npm run lint`, `npm run typecheck`, `npm run build` — blocked because no `node_modules` are installed and npm registry DNS access failed (`EAI_AGAIN`). CLI tools `eslint` and `next` are absent here. Do not interpret syntax tests as a successful typecheck or production build.
- Live integration with NestJS/PostgreSQL — backend not supplied.
- Browser desktop/mobile visual and E2E tests — browser navigation was blocked by execution policy. The design has responsive CSS, but screenshot comparison on the actual app is still required.
- Lighthouse, INP, CLS, actual screen-reader and mobile keyboard behavior — require a browser runtime and functioning server.

## Mandatory predeployment commands

```bash
npm install
npm run test:smoke
npm run lint
npm run typecheck
npm run build
npm run dev
```

Complete manual test matrix at 320, 390, 768, 1024, and 1440px widths:

1. New search, loading status, success, no results, error, timeout, cancel, retry.
2. Source filter and pagination with deliberately slow requests; old results remain visible but clearly indicated as stale, and stale requests never overwrite newer ones.
3. New successful response animates; history replay renders immediately; reduced-motion preference disables motion; Arabic text remains verbatim.
4. Verified/research/mock source distinctions, links, source license, Arabic/translation, grade and attribution.
5. Research-only records cannot be saved permanently or copied; mock records are clearly identified.
6. Sidebar collapse, mobile drawer, side inspector, Escape handling, focus restore, keyboard traversal.
7. Save and clear state, reload after persistence, dark/light switch, no horizontal overflow, safe-area/virtual keyboard support.

## Implementation note

The recommended `Motion for React` package from the design blueprint was **not added** because installing and testing that dependency was not possible in this environment. Equivalent visible entry/exit, stagger, sidebar, loading-dot and responsive motion is implemented using native CSS transitions/animations and React state. This is an explicit implementation deviation, not an assertion of Motion for React use.
