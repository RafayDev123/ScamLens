# Architecture

```
Browser ── Next.js App Router (RSC + client tool components)
              │
              ├─ /api/v1/*, /api/auth/*, /api/account/*   (Route Handlers wrapped by lib/api.ts: auth, CSRF, rate-limit, validation, usage logging)
              │        └─ lib/services/scan-service.ts  → orchestrates analysis
              │                 ├─ lib/analysis/*        (pure engines: url, lookalike, message, qr, email-header, domain, report)
              │                 ├─ lib/providers/*       (threat-intel adapters: Google Web Risk, URLhaus, labelled fixture)
              │                 └─ lib/security/*        (ssrf, ip, redact, ratelimit, crypto)
              └─ lib/services/store.ts → Drizzle → PostgreSQL
Optional: worker/redirect-worker.ts (isolated header-only redirect inspection)
```

## Boundaries
UI never contains analysis logic. Engines in `lib/analysis` are pure (no network) except `domain.ts` (RDAP/DNS/TLS). All outbound requests to user-controlled destinations go through `lib/security/ssrf.ts`.

## Risk scoring (documented formula)
`risk = 1 − Π(1 − w(severity) × c(confidence))` → 0–100. w: info 0, low .10, medium .28, high .55, critical .90. c: low .55, medium .80, high 1.0.
Verdict: confirmed external listing → Likely Malicious; risk ≥ 60 High Risk; ≥ 35 Suspicious; ≥ 12 (or any medium finding) Caution; otherwise No Known Threat Detected *only if* a reputation source answered (or the analysis is inherently local, e.g. messages); else Inconclusive.
Separately reported: **confidence** (corroboration, capped at medium if coverage < 50 %), **coverage** (responding ÷ applicable sources), **freshness** (source timestamps). Provider disagreement is explained. The synthetic test fixture never counts as coverage and can never produce Likely Malicious.

## Deviations from the brief (honest list)
- PostgreSQL + Drizzle + cookie sessions instead of Supabase Auth/RLS (RLS SQL provided for Supabase deployments; ownership is enforced in `store.ts` on every query).
- Single Next.js package (npm) instead of a pnpm monorepo; module boundaries are directories under `src/lib`.
- Hand-built Tailwind components instead of shadcn/ui; React Hook Form and TanStack Query were not needed (native forms, small fetch hook).
- Bulk analysis requires an account; CSV parsed in the browser.
- Redis not used: rate limiting is database-backed.
