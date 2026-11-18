# Environment variables (all used by the code)
| Variable | Required | Used for |
|---|---|---|
| DATABASE_URL | yes | PostgreSQL connection |
| NEXT_PUBLIC_APP_URL | yes (prod) | canonical URLs, share links, Secure cookies |
| ADMIN_EMAILS | no | emails granted admin role |
| WEB_RISK_API_KEY | no | Google Web Risk adapter |
| URLHAUS_API_TOKEN | no | URLhaus adapter |
| RDAP_BASE_URL | no | RDAP endpoint (default https://rdap.org) |
| REDIRECT_INSPECTION_MODE / REDIRECT_WORKER_URL / REDIRECT_WORKER_SECRET | no | redirect inspection mode & worker |
| EXTRA_BRANDS_JSON / EXTRA_SHORTENERS | no | configurable brand and shortener lists |
| ENABLE_TEST_FIXTURES | no | synthetic labelled fixture host (default on; disable in production) |
| EMAIL_PROVIDER_API_KEY / EMAIL_FROM | no | Resend email for password resets |
Variables from the brief that are **not** used (Supabase keys, Redis, Sentry, encryption key) are intentionally omitted.
