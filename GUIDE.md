# ScamLens Setup Guide (accounts, keys, deployment)

## 1. Which services need accounts?
| Service | Needed? | Purpose | Paid? |
|---|---|---|---|
| PostgreSQL (any host: Neon, Supabase, RDS, local) | **Required** | Persistence | Free tiers exist |
| Hosting (Vercel for the web app) | For deployment | Run Next.js | Free hobby tier; commercial use needs a paid plan |
| Container host (Fly.io, Railway, Render, ECS…) | Recommended | Redirect worker with egress filtering | Usually paid/low cost |
| Google Cloud (Web Risk API) | Optional | Phishing/malware URL lists | **Commercial use is billed** after free quota. *Google Safe Browsing API is non-commercial only – do not use it for a monetized product.* |
| abuse.ch (URLhaus) | Optional | Malware URL data | Free Auth-Key; review terms for commercial use |
| Resend (email) | Optional | Password-reset emails | Free tier available |

## 2. Where to get each credential
- **WEB_RISK_API_KEY** – Google Cloud console → create project → enable *Web Risk API* → enable billing → Credentials → API key (restrict to the Web Risk API and your server IPs).
- **URLHAUS_API_TOKEN** – https://auth.abuse.ch/ → create account → Auth-Key.
- **EMAIL_PROVIDER_API_KEY / EMAIL_FROM** – https://resend.com → API key and a verified sender domain.
- **DATABASE_URL** – connection string of your Postgres.

## 3. Where to put them
Local: `.env` (copy from `.env.example`). Vercel: Project → Settings → Environment Variables. Never commit `.env`.

## 4. Optional vs required
Required: `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`. Everything else is optional. Without provider keys the app still works with **local analysis only** and says so in every report.

## 5. Local development
```bash
cp .env.example .env && npm ci && npx drizzle-kit push && npm run dev
```
Set `ADMIN_EMAILS=you@example.com`, register with that email, and `/app/admin` becomes available.

## 6. Deploy the web app on Vercel
1. Import the repo, framework = Next.js, build `npm run build`.
2. Add environment variables (above). Set `NEXT_PUBLIC_APP_URL=https://your-domain` and `ENABLE_TEST_FIXTURES=false`.
3. Set `REDIRECT_INSPECTION_MODE=worker` (+ `REDIRECT_WORKER_URL`, `REDIRECT_WORKER_SECRET`) or `disabled`.
4. Run migrations (step 8) against the production database.

## 7. Deploy the redirect worker separately
`docker build -f Dockerfile.worker -t scamlens-worker .` then run it where outbound traffic is firewalled: allow only TCP 80/443/8080/8443 to the public internet, deny RFC1918, 169.254.0.0/16 (cloud metadata), loopback and ULA ranges. Set the same `REDIRECT_WORKER_SECRET` on the app and worker. Health: `GET /health`.

## 8. Database migrations
`npx drizzle-kit push` (direct) or apply `db/migrations/0000_*.sql` with `psql "$DATABASE_URL" -f …`. Optional sample data: `psql "$DATABASE_URL" -f db/seed.sql` (demonstration data only). Optional Supabase RLS: `db/rls-supabase.sql`.

## 9. Verify integrations
`GET /api/v1/providers/status` shows each provider as `configured` / `configuration_required` and the last real result. Then scan a known test URL (Google publishes test URLs at testsafebrowsing.appspot.com for Web Risk) with “Check external reputation databases” ticked and confirm the report lists the provider as *Responded*. The synthetic host `*.fixture.scamlens.test` only exercises the pipeline and is labelled as not real intelligence.
Status of this delivery: **no external API keys were available during development, so Web Risk, URLhaus and Resend were NOT exercised against live services.** RDAP, DNS and TLS lookups were exercised live.
