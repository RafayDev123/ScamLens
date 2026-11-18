# Security

## SSRF & outbound requests (`src/lib/security/ssrf.ts`, `ip.ts`)
- Only http/https; ports 80/443/8080/8443; embedded credentials rejected; obfuscated IPs normalized by the WHATWG URL parser.
- Hostnames resolved once; **all** records must be public (BlockList covers loopback, RFC1918, CGNAT, link-local incl. 169.254.169.254, ULA, documentation, multicast, reserved, NAT64/6to4, IPv4-mapped IPv6).
- Connection pinned to the validated address through a custom `lookup` (DNS-rebinding safe). Every redirect hop re-validated; max 6 hops; per-hop and total timeouts; header-only requests, bodies never read.
- Domain tool: DNS queries + one TLS handshake to a validated public IP; no port scanning.
- Redirect inspection can run in an isolated worker (`REDIRECT_INSPECTION_MODE=worker`) behind infrastructure egress rules (see GUIDE.md). **Inline mode is for development/small deployments; use the worker in production.**
- Provider calls use fixed hosts, `redirect:"error"`, timeouts and zod response validation.

## Privacy
URLs: credentials, tokens, query values and fragments redacted before storage/display; no full URLs in logs. Messages: digits ≥ 6, e-mails, cards, phones, link secrets redacted; truncated; never sent to third parties. QR images never uploaded. IPs hashed. External providers only receive data with explicit per-scan consent.

## Auth & sessions
scrypt (N=16384) hashes; random 256-bit session tokens stored as SHA-256; HttpOnly, SameSite=Lax, Secure when `NEXT_PUBLIC_APP_URL` is https; login/register/forgot rate-limited; generic failure messages; reset tokens single-use, 1 h, revoke all sessions. CSRF: Origin check for cookie-authenticated mutations. Admin role verified server-side on page and API (non-admin gets 404).

## Data protection
Owner-scoped queries everywhere; share tokens are 256-bit, stored hashed, expiring and revocable; API keys shown once, stored hashed; reports private by default; `noindex` on app/shared/auth pages; share pages send `no-referrer`.

## XSS / uploads
All dynamic text rendered through React escaping; JSON-LD built from static data with `<` escaped; QR upload validated by MIME, size (5 MB) and magic bytes, decoded client-side.

## Known limitations / residual risk
- Inline redirect inspection runs in the app process; application-level checks are strong but infrastructure egress filtering is still recommended.
- RLS policies are provided but not exercised in tests (no Supabase available).
- In-memory provider cache is per instance.
- Message rules are pattern-based and can be evaded.
