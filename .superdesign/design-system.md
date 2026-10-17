# Matanexa — UI refresh, 17 October 2026

Local reference search using the existing Next.js App Router and NestJS API.
Desktop sidebar 272px (245px on smaller laptops), mobile drawer, content 830px,
composer pinned to the workspace bottom. Five topic prompts, independent queries,
result cards and native detail dialogs. No generated religious answers.

## Palette and type

- Light: canvas #f7f9fe, panel #ffffff, ink #17243f, muted #62708a,
  border #e3e9f3, cobalt #315ce8, accent surface #edf2ff.
- Sidebar: midnight #101c35, text #b8c6df, cyan #68dfed accents.
- Dark: canvas #111a2c, panel #19243a, ink #edf2fd, muted #a3b2cd,
  border #2b3953, accent #93b1ff; sidebar #0b1426.
- System sans: Inter when available, Segoe UI/system fallback. No downloaded fonts.
- Arabic: Noto Naskh Arabic / Traditional Arabic / serif, RTL, generous line height.
- Radius 8–22px. Fine borders, restrained shadows and small blue gradients on
  brand marks. Lucide icons; no new runtime dependencies.

## Motion

Welcome entrance 700ms; sidebar grid 360ms; card entrance 450ms with small stagger;
dialog 250ms, drawer 300ms, hover 180–240ms. Search ring, dots, skeleton pulse and
30ms-character typing animate fixed interface status only. No artificial result
delay, progress percentage, generated answer, or animation of original source text.
Reduced motion disables CSS animations/transitions and typing immediately,
including when the preference changes while searching. Timers clean up on cancel.

## Honesty and accessibility

Research-only notices, original source text, unavailable grading, restricted
copy/save/persistence and backend scope are preserved. Status wording does not
claim provider internals or guarantee relevance. Every query is independent.
Native dialogs retain focus trapping, Escape and focus restoration. Collapsed
desktop navigation is inert. Light/dark, keyboard focus and mobile scrolling remain.

Superdesign CLI preflight was blocked by automatic approval review because it
downloads and executes unpinned third-party code. No CLI workaround was used;
the authorized UI redesign was implemented and verified locally in React/CSS.
