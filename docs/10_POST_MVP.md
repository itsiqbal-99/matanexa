# 10 — Explicitly Deferred: Deployment & Future

**This document is a parking lot, not an implementation instruction.** Do not generate production deployment configs or open paid services now.

When G0–G5 pass and the user requests production:
1. Re-evaluate cheapest sustainable frontend host for Next.js (static export only if feature-compatible; otherwise SSR-capable platform).
2. Re-evaluate sustainable free NestJS Node hosting, noting idle cold start and resource limits.
3. Verify production CORS, rate limiting, secrets, API base URLs, health checks, database limits, AI quotas, CI/CD.
4. Secure public data and verify reuse licenses, source attribution and data correction workflow.
5. Recheck Matanexa name (brand/trademark/domain/username), do not assume name available.

Possible later features: transliteration helper, source compare, better semantic evaluations, citation sharing, multilanguage query, search analytics with privacy, user-requested detail discussions constrained to source texts. No feature is committed.
