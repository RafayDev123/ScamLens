# Database

Defined in `src/db/schema.ts`; SQL in `db/migrations/`; seed in `db/seed.sql` (demonstration data).

| Table | Purpose | Key relationships |
|---|---|---|
| users | accounts (scrypt hashes, role) | – |
| sessions | server-side sessions (token hash) | → users (cascade) |
| password_reset_tokens | single-use reset tokens (hash) | → users |
| user_preferences | theme, history, retention, notifications | 1:1 → users |
| scans | one row per analysis; owner = user **or** guest cookie id; redacted subject; verdict, scores, expiry | → users (cascade) |
| findings | queryable finding summaries | → scans (cascade) |
| threat_matches | provider matches (JSONB metadata) | → scans |
| analysis_sources | per-source status for each scan | → scans |
| reports | frozen report snapshot (JSONB). `reports.id = scans.id` | 1:1 → scans |
| report_share_tokens | SHA-256 of unguessable tokens, expiry, revocation | → reports |
| api_keys | prefix + SHA-256 hash, revocation | → users |
| usage_events | request log (route, status, error code – no URLs) | → users/api_keys (set null) |
| audit_logs | security events (hashed IP) | → users (set null) |
| provider_status | last real result per provider | – |
| rate_limit_records | fixed-window counters | – |

All primary keys are UUIDs; timestamps are `timestamptz`. Indexes cover owner+time, type, expiry and token hashes. `workspaces` (optional in the brief) were not implemented.
Retention: guest/unsaved scans expire after 24 h; saved scans after the user's retention (default 90 d). `purgeExpired()` runs opportunistically (throttled, 10 min). Deleting a user cascades to everything they own.
Row-level security: ownership is enforced in the service layer; `db/rls-supabase.sql` adds RLS for Supabase-style exposure. RLS isolation tests could not be run (no Supabase); app-level isolation is covered by `tests/e2e/smoke.mjs`.
