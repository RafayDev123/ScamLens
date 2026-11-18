# ScamLens — Check Before You Click. Understand Before You Trust.

ScamLens is a full-stack web application for online-scam detection: **URL Scanner**, **Message Analyzer** (English / Urdu / Roman Urdu), **QR Code Checker**, **Domain Intelligence** and a unified **Explainable Risk Report**, plus an Email Header Analyzer, lookalike-domain detector, short-link inspector, scan history, Security Center, versioned public API and an admin area.

> Stack note: this build targets **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + PostgreSQL via Drizzle ORM** with first-party cookie sessions (scrypt password hashing). The original brief suggested Supabase/pnpm/shadcn; the delivered runtime uses plain PostgreSQL + npm instead (see `docs/ARCHITECTURE.md` → "Deviations"). Optional Supabase RLS policies are provided in `db/rls-supabase.sql`.

## Quick start
```bash
cp .env.example .env            # set DATABASE_URL and NEXT_PUBLIC_APP_URL
npm ci
npx drizzle-kit push            # create tables (or run db/migrations/*.sql)
npm run build && npm run start  # or: npm run dev
```
Open http://localhost:3000. Guests can scan immediately; register for history, saved reports, share links and API keys.

## Commands
| Task | Command |
|---|---|
| Type generation | `npx next typegen` |
| Type check | `npm exec tsc -- --noEmit` |
| Lint | `npm run lint` |
| Unit + security tests | `npx vitest run` |
| End-to-end smoke (needs running server) | `BASE=http://127.0.0.1:3100 node tests/e2e/smoke.mjs` |
| Production build | `npm run build` |
| Redirect worker | `REDIRECT_WORKER_SECRET=… npx tsx worker/redirect-worker.ts` |

## Documentation
`GUIDE.md` (credentials & deployment), `docs/ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `SECURITY.md`, `SEO.md`, `DEPLOYMENT.md`, `TESTING.md`, `ENVIRONMENT.md`.

## Principles
No fake results · no "100% safe" verdicts · providers without keys are shown as *configuration required* · local-only results are labelled · messages are never sent to third parties · QR images never leave the browser.
