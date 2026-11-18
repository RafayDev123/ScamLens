import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public API v1 – Documentation",
  description: "ScamLens REST API v1: authenticate with an API key, submit URL, message, QR, domain and email-header scans and retrieve explainable reports.",
  alternates: { canonical: "/developers" },
};

const EX = `curl -X POST https://YOUR-HOST/api/v1/scans/url \\
  -H "Authorization: Bearer sl_live_XXXXXXXX" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/login","shareWithProviders":false,"inspectRedirects":false}'`;

const ROWS: [string, string, string][] = [
  ["POST", "/api/v1/scans/url", "Analyze a URL"], ["POST", "/api/v1/scans/url/bulk", "Up to 25 URLs (account required)"], ["POST", "/api/v1/scans/message", "Analyze message text"],
  ["POST", "/api/v1/scans/qr", "Analyze decoded QR text"], ["POST", "/api/v1/scans/domain", "Domain intelligence"], ["POST", "/api/v1/scans/email-header", "Analyze raw headers"],
  ["GET", "/api/v1/scans", "List scans (page, pageSize, type, q)"], ["GET", "/api/v1/scans/:id", "Get a scan + report"], ["DELETE", "/api/v1/scans/:id", "Delete a scan"],
  ["GET", "/api/v1/reports/:id", "Get a report with metadata"], ["POST", "/api/v1/reports/:id/export", "Export {format:'pdf'|'json'}"], ["POST", "/api/v1/reports/:id/share", "Create a 7-day private link"],
  ["DELETE", "/api/v1/reports/:id/share", "Revoke share links"], ["GET", "/api/v1/providers/status", "Provider availability (no secrets)"],
];

export default function Developers() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <p className="mono text-xs uppercase tracking-wider text-accent">Public API · v1</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">ScamLens API</h1>
      <p className="mt-4 rounded-lg border-l-4 border-accent bg-surface p-4">All endpoints return JSON of the form <code className="mono">{"{ data, meta: { requestId } }"}</code> or <code className="mono">{"{ error: { code, message, requestId } }"}</code>. Create an API key in <a className="text-accent underline" href="/app/settings">Settings</a>; send it as a Bearer token. Keys are shown once and stored only as SHA-256 hashes.</p>
      <div className="prose-sl mt-6">
        <h2>Endpoints</h2>
        <table><thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead><tbody>{ROWS.map(([m, p, d]) => <tr key={m + p}><td className="mono">{m}</td><td className="mono">{p}</td><td>{d}</td></tr>)}</tbody></table>
        <h2>Example</h2>
        <pre className="mono overflow-x-auto rounded-lg border border-line bg-panel p-4 text-xs">{EX}</pre>
        <h2>Limits &amp; errors</h2>
        <ul><li>Scan endpoints: 10/hour for guests (per IP), 60/hour per account or key; bulk: 5/hour. Headers: <code>X-RateLimit-Limit/Remaining/Reset</code>, <code>Retry-After</code> on 429.</li><li>Status codes: 200/201, 400 validation_error, 401 unauthenticated/invalid_api_key, 403, 404 not_found, 413, 415, 422 (input rejected), 429 rate_limited, 500 internal_error.</li><li>Request bodies must be <code>application/json</code>; maximum sizes apply per endpoint.</li></ul>
        <p>Full documentation with schemas: <code>docs/API.md</code> in the source distribution.</p>
      </div>
    </div>
  );
}
