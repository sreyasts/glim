# Verification — 25 October 2026

- `npm run check`: 15 tests passed; TypeScript and production build passed.
- `npm audit`: no vulnerabilities after upgrading `@fastify/static` to a patched release. Production-only audit is also part of CI.
- Browser smoke check: globe renders; real NPS source image loads; saving a place changes its saved state; searching Japan narrows the catalog; creating a rain rule persists it in Your alerts; pausing changes it to a resumable rule. No browser console errors in these flows.
- Source checks: seven inline image endpoints returned JPEGs. Two outdated source pages were replaced with working pages; Zermatt's official webcam collection was added. Source HTTP checks cannot prove live frame freshness, and USGS may present an automated-client challenge on its information pages.
- Mobile: checked at 390px width; no document overflow. The initial check exposed a filter-row flex layout problem, which was corrected. Navigation icons have explicit accessible names.

Not verified end-to-end: background Web Push delivery (requires deployment credentials and a consenting device), Docker runtime, external camera uptime beyond the check, search-engine indexing, production traffic behavior, or user acquisition. These are not claimed as completed launch outcomes.

The 3D globe loads lazily in a separate bundle of approximately 540 KB gzip. This is a material download on slow mobile connections; the accessible place list and core interface do not depend on that bundle completing.
