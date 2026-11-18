# SEO / AEO / GEO

- Public pages are server-rendered (verified in `tests/e2e/smoke.mjs`): `/`, `/tools/*` (5 tool landing pages with embedded working tools), `/learn` + 8 original articles, `/methodology`, `/privacy`, `/developers`.
- Metadata API: unique titles/descriptions, canonical URLs, Open Graph/Twitter, `opengraph-image`, `icon.svg`, `manifest.webmanifest`, `sitemap.xml`, `robots.txt` (disallows `/app`, `/api`, `/shared`, auth pages); private pages carry `noindex`.
- Structured data (JSON-LD): Organization, WebSite, SoftwareApplication (no ratings/reviews), BreadcrumbList, Article. **FAQPage markup intentionally omitted**: Google restricts FAQ rich results to well-known government/health sites; FAQs are visible HTML instead.
- AEO: answer-first intros, question headings, tables, glossary, visible author (ScamLens Editorial Team) and updated dates, references to FTC/CISA/NCSC/IETF. No fabricated quotes, statistics or reviews.
- GEO: consistent product description, methodology page explaining evidence & limits. No llms.txt was added (would require maintenance and offers no guaranteed benefit). No ranking or AI-citation promises are made.
- Not measured here: Lighthouse/Core Web Vitals scores were not run in this environment.
