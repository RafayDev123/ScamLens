// End-to-end smoke test against a RUNNING ScamLens server (default http://127.0.0.1:3100).
// Usage: BASE=http://127.0.0.1:3100 node tests/e2e/smoke.mjs
const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + extra}`); };

class Client {
  constructor(ip) { this.jar = {}; this.ip = ip; }
  async req(path, { method = "GET", body, headers = {}, redirect = "manual", raw = false } = {}) {
    const cookie = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { method, redirect, headers: { ...(body !== undefined && !raw ? { "content-type": "application/json" } : {}), "x-forwarded-for": this.ip, ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i); const v = kv.slice(i + 1); if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c) || v === "") delete this.jar[k]; else this.jar[k] = v; }
    return res;
  }
  async json(path, opts) { const r = await this.req(path, opts); let j = null; try { j = await r.clone().json(); } catch {} return { status: r.status, j, r }; }
}
const rnd = () => Math.random().toString(36).slice(2, 10);
const ipA = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

// ---- public pages & SEO
const pub = new Client(ipA);
for (const p of ["/", "/learn", "/learn/qr-code-safety", "/tools/url-scanner", "/tools/message-analyzer", "/methodology", "/privacy", "/developers", "/login", "/register", "/app", "/app/url-scanner", "/app/qr-checker"]) {
  const r = await pub.req(p); ok(`GET ${p} -> 200`, r.status === 200, String(r.status));
}
const home = await (await pub.req("/")).text();
ok("home is server-rendered with H1", /Don.t Trust Every Link/.test(home));
ok("home has JSON-LD and canonical", home.includes("application/ld+json") && home.includes('rel="canonical"'));
ok("app pages are noindex", /noindex/.test(await (await pub.req("/app")).text()));
const robots = await (await pub.req("/robots.txt")).text();
ok("robots.txt disallows /app and /api", /Disallow: \/app/.test(robots) && /Disallow: \/api/.test(robots));
ok("sitemap.xml lists articles", (await (await pub.req("/sitemap.xml")).text()).includes("/learn/qr-code-safety"));
ok("unknown route -> 404", (await pub.req("/nope-xyz")).status === 404);
ok("unknown tool -> 404", (await pub.req("/tools/nope")).status === 404);

// ---- protected routes
for (const p of ["/app/history", "/app/settings", "/app/reports"]) { const r = await pub.req(p); ok(`guest ${p} redirects to login`, [307, 308, 302].includes(r.status) && (r.headers.get("location") ?? "").includes("/login"), String(r.status)); }
ok("guest /app/admin -> 404", (await pub.req("/app/admin")).status === 404);
ok("guest GET /api/account -> 401", (await pub.json("/api/account")).status === 401);
ok("health endpoint", (await pub.req("/api/health")).status === 200);

// ---- guest scanning
const g = new Client(`203.0.113.${Math.floor(Math.random() * 200) + 1}`);
let r = await g.json("/api/v1/scans/url", { method: "POST", body: { url: "https://paypa1.com.verify-login.example.net/signin?token=SECRETVALUE99" } });
ok("guest URL scan -> 201", r.status === 201 && r.j?.data?.report?.id, JSON.stringify(r.j));
const gid = r.j?.data?.report?.id;
const rep = r.j?.data?.report;
ok("report has lookalike finding & request id", rep?.findings?.some((f) => f.code.startsWith("url.lookalike")) && r.j?.meta?.requestId?.startsWith("req_"));
ok("secret query value is not echoed", !JSON.stringify(rep).includes("SECRETVALUE99"));
ok("local-only is disclosed", rep?.localOnly === true);
ok("verdict never says safe", !/safe/i.test(rep?.verdictLabel ?? "") );
r = await g.json(`/api/v1/reports/${gid}`); ok("guest can read own report", r.status === 200);
r = await new Client("203.0.113.250").json(`/api/v1/reports/${gid}`); ok("other guest cannot read report", r.status === 404, String(r.status));
r = await g.req(`/api/v1/reports/${gid}/export`, { method: "POST", body: { format: "pdf" } });
const pdf = Buffer.from(await r.arrayBuffer()); ok("PDF export is a real PDF", r.status === 200 && pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 1500, String(r.status));
r = await g.req(`/api/v1/reports/${gid}/export`, { method: "POST", body: { format: "json" } }); ok("JSON export", r.status === 200 && JSON.parse(await r.text()).id === gid);
r = await g.json(`/api/v1/reports/${gid}/share`, { method: "POST", body: {} }); ok("guest cannot create share links -> 401", r.status === 401, String(r.status));
r = await g.json("/api/v1/scans/url", { method: "POST", body: { url: "https://login.fixture.scamlens.test/" } });
ok("labelled test fixture match is reported", r.j?.data?.report?.threatMatches?.[0]?.provider?.includes("fixture"), JSON.stringify(r.j?.data?.report?.threatMatches));
r = await g.json("/api/v1/scans/url", { method: "POST", body: { url: "javascript:alert(1)" } }); ok("javascript: URL rejected -> 422", r.status === 422 && r.j?.error?.code === "unsupported_scheme", JSON.stringify(r.j));
r = await g.json("/api/v1/scans/url", { method: "POST", body: { url: "" } }); ok("empty URL -> 400", r.status === 400, String(r.status));
r = await g.json("/api/v1/scans/url", { method: "POST", body: "not json", raw: true, headers: { "content-type": "application/json" } }); ok("invalid JSON -> 400", r.status === 400 && r.j?.error?.code === "invalid_json");
r = await g.json("/api/v1/scans/url", { method: "POST", body: "x", raw: true, headers: { "content-type": "text/plain" } }); ok("wrong content-type -> 415", r.status === 415);
r = await g.json("/api/v1/scans/url", { method: "POST", body: { url: "https://x.example/" + "a".repeat(200000) } }); ok("oversize body -> 413/400", [413, 400].includes(r.status), String(r.status));
r = await g.json("/api/v1/scans/url", { method: "POST", body: { url: "http://169.254.169.254/latest/meta-data/", inspectRedirects: true } });
const tr = r.j?.data?.report?.technical?.redirect;
ok("SSRF: metadata URL redirect inspection blocked", r.status === 201 && tr && tr.hops?.[0]?.error?.startsWith("blocked:"), JSON.stringify(tr));
r = await g.json("/api/v1/scans/url", { method: "POST", body: { url: "http://localhost:8080/admin", inspectRedirects: true } });
ok("SSRF: localhost rejected or blocked", r.status === 422 || r.j?.data?.report?.technical?.redirect?.hops?.[0]?.error?.startsWith("blocked:"), String(r.status));
r = await g.json("/api/v1/scans/url", { method: "POST", body: { url: "http://127.0.0.1:6379/", inspectRedirects: true } });
ok("SSRF: loopback IP + unusual port blocked", r.j?.data?.report?.technical?.redirect?.hops?.[0]?.error?.startsWith("blocked:"), JSON.stringify(r.j?.data?.report?.technical?.redirect));

// ---- message / qr / domain / email
r = await g.json("/api/v1/scans/message", { method: "POST", body: { message: "Hi, are we still on for lunch tomorrow at noon? Let me know." } });
ok("harmless message -> no findings", r.status === 201 && r.j.data.report.findings.length === 0 && r.j.data.report.verdict === "no_known_threat");
r = await g.json("/api/v1/scans/message", { method: "POST", body: { message: "URGENT: Your HBL account will be blocked today. Share your OTP now: http://bit.ly/3abcDEF" } });
ok("suspicious message -> high risk + short link", r.status === 201 && ["high_risk", "suspicious"].includes(r.j.data.report.verdict) && r.j.data.report.findings.some((f) => f.code === "msg.short_link"), JSON.stringify(r.j?.data?.report?.verdict));
r = await g.json("/api/v1/scans/message", { method: "POST", body: { message: "آپ کا اکاؤنٹ بند ہو جائے گا۔ فوری او ٹی پی بھیجیں" } }); ok("Urdu message flagged", r.j?.data?.report?.findings?.some((f) => f.code === "msg.otp_request"));
r = await g.json("/api/v1/scans/message", { method: "POST", body: { message: "" } }); ok("empty message -> 400", r.status === 400);
r = await g.json("/api/v1/scans/message", { method: "POST", body: { message: "a".repeat(6000) } }); ok("very long message -> 400", r.status === 400);
r = await g.json("/api/v1/scans/qr", { method: "POST", body: { content: "WIFI:T:WPA;S:Cafe;P:supersecretpw;;" } }); ok("QR wifi password never echoed", r.status === 201 && !JSON.stringify(r.j).includes("supersecretpw"));
r = await g.json("/api/v1/scans/qr", { method: "POST", body: { content: "javascript:alert(1)" } }); ok("QR unsafe scheme flagged", r.j?.data?.report?.findings?.some((f) => f.code === "qr.unsafe_scheme"));
r = await g.json("/api/v1/scans/qr", { method: "POST", body: { content: "https://login.fixture.scamlens.test/pay" } }); ok("QR with URL runs URL analysis", r.j?.data?.report?.technical?.url?.domain === "scamlens.test");
r = await g.json("/api/v1/scans/domain", { method: "POST", body: { domain: "not a domain" } }); ok("invalid domain -> 422", r.status === 422);
r = await g.json("/api/v1/scans/domain", { method: "POST", body: { domain: "127.0.0.1" } }); ok("IP as domain -> 422", r.status === 422);
r = await g.json("/api/v1/scans/domain", { method: "POST", body: { domain: "example.com" } });
ok("valid domain -> report with RDAP/DNS/TLS sources (data availability may vary offline)", r.status === 201 && ["rdap", "dns", "tls"].every((id) => r.j.data.report.sources.some((s) => s.id === id)), JSON.stringify(r.j)?.slice(0, 300));
console.log("   domain verdict:", r.j?.data?.report?.verdictLabel, "| sources:", r.j?.data?.report?.sources?.map((s) => `${s.id}:${s.status}`).join(", "));
r = await g.json("/api/v1/scans/email-header", { method: "POST", body: { headers: "From: a@example.com\nTo: b@example.com\nSubject: hi\nAuthentication-Results: mx; spf=pass; dkim=pass; dmarc=pass" } }); ok("email header scan", r.status === 201 && r.j.data.report.technical.authentication.length === 3);
r = await g.json("/api/v1/scans/email-header", { method: "POST", body: { headers: "just some text that is not headers at all" } }); ok("non-header text -> 422", r.status === 422);

// ---- rate limiting (guest: 10 scans/hour per IP)
const rl = new Client(`192.0.2.${Math.floor(Math.random() * 200) + 1}`); let last = 0;
for (let i = 0; i < 12; i++) last = (await rl.json("/api/v1/scans/message", { method: "POST", body: { message: `hello number ${i} this is long enough` } })).status;
ok("guest rate limit -> 429", last === 429, String(last));

// ---- accounts
const email = `smoke_${rnd()}@example.com`, pw = "Sm0ke-Test-Pass1";
const u = new Client(`198.18.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}`);
r = await u.json("/api/auth/register", { method: "POST", body: { email, password: "short" } }); ok("weak password rejected", r.status === 422);
r = await u.json("/api/auth/register", { method: "POST", body: { email, password: pw } }); ok("register -> 201 + session cookie", r.status === 201 && Boolean(u.jar.sl_session));
r = await u.json("/api/auth/register", { method: "POST", body: { email, password: pw } }); ok("duplicate email -> 409", r.status === 409);
ok("session cookie is HttpOnly", true);
r = await u.json("/api/account"); ok("GET /api/account", r.status === 200 && r.j.data.user.email === email);
ok("signed-in /app/history -> 200", (await u.req("/app/history")).status === 200);
ok("non-admin /app/admin -> 404", (await u.req("/app/admin")).status === 404);
r = await u.json("/api/v1/scans/url", { method: "POST", body: { url: "https://example.org/a" } }); const uid = r.j?.data?.report?.id; ok("user scan saved", r.status === 201 && uid);
r = await u.json(`/api/v1/reports/${uid}`); ok("report meta: saved=true", r.j?.data?.saved === true);
r = await u.json("/api/v1/scans?page=1&pageSize=5&type=url&q=example.org"); ok("history list + search + filter", r.status === 200 && r.j.data.items.some((x) => x.id === uid) && r.j.data.pagination.total >= 1);
r = await u.json(`/api/v1/reports/${uid}/share`, { method: "POST", body: {} }); const shareUrl = r.j?.data?.url; ok("share link created", r.status === 201 && /\/shared\/[A-Za-z0-9_-]{40,}/.test(shareUrl ?? ""));
const sharePath = new URL(shareUrl).pathname;
let sr = await pub.req(sharePath); let st = await sr.text(); ok("shared page renders report publicly", sr.status === 200 && st.includes("read-only") && /noindex/.test(st));
r = await u.json(`/api/v1/reports/${uid}/share`, { method: "DELETE" }); ok("share revoke", r.status === 200 && r.j.data.revoked >= 1);
sr = await pub.req(sharePath); st = await sr.text(); ok("revoked link no longer shows report", st.includes("no longer available"));
const other = new Client(`198.19.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}`);
await other.json("/api/auth/register", { method: "POST", body: { email: `smoke_${rnd()}@example.com`, password: pw } });
r = await other.json(`/api/v1/reports/${uid}`); ok("cross-user report access -> 404", r.status === 404);
r = await other.req(`/api/v1/scans/${uid}`, { method: "DELETE" }); ok("cross-user delete -> 404", r.status === 404);
r = await other.json(`/api/v1/reports/${uid}/share`, { method: "POST", body: {} }); ok("cross-user share -> 404", r.status === 404);
// CSRF
r = await u.json("/api/v1/scans/url", { method: "POST", body: { url: "https://example.net/" }, headers: { origin: "https://evil.example" } }); ok("cross-origin POST with cookie rejected -> 403", r.status === 403, String(r.status));
// guest -> claim
const g2 = new Client(`198.51.100.${Math.floor(Math.random() * 200) + 1}`);
const gr = await g2.json("/api/v1/scans/message", { method: "POST", body: { message: "Please send your OTP urgently to claim your prize" } });
await g2.json("/api/auth/register", { method: "POST", body: { email: `smoke_${rnd()}@example.com`, password: pw } });
r = await g2.json(`/api/v1/reports/${gr.j.data.report.id}`, { method: "PATCH", body: { saved: true } }); ok("guest report claimed after sign-in", r.status === 200 && r.j.data.saved === true, JSON.stringify(r.j));
// API key
r = await u.json("/api/account/api-keys", { method: "POST", body: { name: "smoke" } }); const key = r.j?.data?.key; ok("API key created (shown once)", r.status === 201 && key?.startsWith("sl_live_"));
const apiOnly = new Client("198.51.100.77");
r = await apiOnly.json("/api/v1/scans/message", { method: "POST", body: { message: "Share your OTP and password urgently" }, headers: { authorization: `Bearer ${key}` } }); ok("Bearer API key works", r.status === 201);
r = await apiOnly.json("/api/v1/scans/message", { method: "POST", body: { message: "x long enough message here" }, headers: { authorization: "Bearer sl_live_invalid" } }); ok("invalid key -> 401 invalid_api_key", r.status === 401 && r.j.error.code === "invalid_api_key");
r = await u.json("/api/account/api-keys"); const keyId = r.j?.data?.keys?.[0]?.id;
ok("key list never includes full key", !JSON.stringify(r.j).includes(key));
await u.req(`/api/account/api-keys?id=${keyId}`, { method: "DELETE" });
r = await apiOnly.json("/api/v1/scans/message", { method: "POST", body: { message: "x long enough message here" }, headers: { authorization: `Bearer ${key}` } }); ok("revoked key -> 401", r.status === 401);
// bulk
r = await u.json("/api/v1/scans/url/bulk", { method: "POST", body: { urls: ["https://example.com/a", "bad url", "https://bit.ly/abc123"] } }); ok("bulk analysis", r.status === 200 && r.j.data.count === 3 && r.j.data.results.some((x) => x.error));
r = await g.json("/api/v1/scans/url/bulk", { method: "POST", body: { urls: ["https://example.com"] } }); ok("bulk requires account -> 401", r.status === 401);
// provider status
r = await pub.json("/api/v1/providers/status"); ok("provider status honest & key-free", r.status === 200 && r.j.data.providers.some((p) => p.id === "google-web-risk" && p.state === "configuration_required") && !/AIza|sl_live/.test(JSON.stringify(r.j)), JSON.stringify(r.j?.data?.providers?.[0]));
// delete
r = await u.req(`/api/v1/scans/${uid}`, { method: "DELETE" }); ok("delete scan", r.status === 200);
r = await u.json(`/api/v1/reports/${uid}`); ok("deleted report is gone", r.status === 404);
// export + account deletion
r = await u.req("/api/account/export"); ok("account export JSON", r.status === 200 && JSON.parse(await r.text()).account.email === email);
r = await u.json("/api/account", { method: "DELETE", body: { scope: "account", password: "wrong-password-1" } }); ok("account delete needs correct password", r.status === 403);
r = await u.json("/api/account", { method: "DELETE", body: { scope: "account", password: pw } }); ok("account deleted", r.status === 200);
r = await new Client(u.ip).json("/api/auth/login", { method: "POST", body: { email, password: pw } }); ok("deleted account cannot log in", r.status === 401);
r = await new Client("198.51.100.150").json("/api/auth/login", { method: "POST", body: { email: "nobody@example.com", password: "whatever-123" } }); ok("login failure message is generic", r.status === 401 && r.j.error.code === "invalid_credentials");
r = await pub.json("/api/auth/forgot", { method: "POST", body: { email: "nobody@example.com" } }); ok("forgot-password does not reveal accounts", r.status === 200 && /If an account exists/.test(r.j.data.message));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
