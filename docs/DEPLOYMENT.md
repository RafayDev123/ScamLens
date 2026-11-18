# Deployment
1. Provision PostgreSQL; apply `db/migrations` (or `drizzle-kit push`).
2. Web app: Vercel or `docker build . && docker run -p 3000:3000 --env-file .env`.
3. Worker: `Dockerfile.worker` on an egress-filtered network; set `REDIRECT_INSPECTION_MODE=worker`.
4. `docker compose up --build` runs db + web + worker locally (set `REDIRECT_WORKER_SECRET`).
5. Smoke test: `BASE=https://host node tests/e2e/smoke.mjs` (creates and deletes its own test accounts; do not run against production with real users unless intended) and `GET /api/health`.
6. Set `ADMIN_EMAILS`, `ENABLE_TEST_FIXTURES=false`, `NEXT_PUBLIC_APP_URL=https://…`.
See GUIDE.md for credentials.
