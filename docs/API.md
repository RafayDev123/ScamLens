# Public API v1

Base: `/api/v1`. Auth: browser session cookie **or** `Authorization: Bearer sl_live_…` (create in Settings → API keys). Guests may call scan endpoints with strict limits.
Success: `{ "data": …, "meta": { "requestId": "req_…" } }`. Error: `{ "error": { "code", "message", "details?", "requestId" } }`.

| Method & path | Body / query | Notes |
|---|---|---|
| POST /scans/url | `{url, shareWithProviders?, inspectRedirects?}` | 201 `{report}` |
| POST /scans/url/bulk | `{urls[1..25], …}` | account/key required; 5 per hour |
| POST /scans/message | `{message ≤ 5000}` | local analysis only |
| POST /scans/qr | `{content, …}` | decoded text only |
| POST /scans/domain | `{domain, shareWithProviders?}` | RDAP/DNS/TLS |
| POST /scans/email-header | `{headers ≤ 30000}` | |
| GET /scans | `page, pageSize≤100, type, q` | paginated, owner-scoped |
| GET /scans/:id · DELETE /scans/:id | | |
| GET /reports/:id · PATCH /reports/:id `{saved:true}` | | PATCH saves/claims |
| POST /reports/:id/export | `{format:"pdf"|"json"}` | file download |
| POST /reports/:id/share · DELETE | | 7-day private link; DELETE revokes all |
| GET /providers/status | | no secrets |

Errors: 400 `validation_error`/`invalid_json`, 401 `unauthenticated`/`invalid_api_key`, 403 `forbidden`/`bad_origin`, 404 `not_found`, 413 `payload_too_large`, 415, 422 (input rejected, e.g. `unsupported_scheme`), 429 `rate_limited` (+`Retry-After`), 500 `internal_error`.
Rate limits (per hour): scans 10 guest / 60 user-or-key; others 120 / 600; auth endpoints 10 per 15 min. Headers `X-RateLimit-*`. Usage is recorded in `usage_events`.

```bash
curl -X POST $HOST/api/v1/scans/url -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/login"}'
```
Report shape: `types.ts → Report` (verdict, scores{severity,confidence,coveragePct,freshness}, findings[], sources[], technical, explanation, recommendations, limitations).
