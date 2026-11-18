/**
 * Isolated redirect-inspection worker. Exposes POST /inspect {url} guarded by a shared secret.
 * It reuses the same restricted fetcher as the app (public IPs only, pinned DNS, per-hop revalidation,
 * header-only requests). Deploy it on a network with infrastructure-level egress filtering.
 * Run: npx tsx worker/redirect-worker.ts
 */
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { inspectRedirects } from "../src/lib/security/ssrf";

const SECRET = process.env.REDIRECT_WORKER_SECRET ?? "";
const PORT = Number(process.env.PORT ?? 8787);
if (!SECRET || SECRET.length < 16) {
  console.error("REDIRECT_WORKER_SECRET (>=16 chars) is required");
  process.exit(1);
}
const ok = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

createServer(async (req, res) => {
  const send = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
  if (req.method !== "POST" || req.url !== "/inspect") return send(404, { error: "not_found" });
  const auth = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!ok(auth, SECRET)) return send(401, { error: "unauthorized" });
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 8192) return send(413, { error: "too_large" }); }
  try {
    const { url } = JSON.parse(raw) as { url?: string };
    if (typeof url !== "string") return send(400, { error: "invalid_request" });
    return send(200, await inspectRedirects(url));
  } catch {
    return send(400, { error: "invalid_request" });
  }
}).listen(PORT, () => console.log(`redirect worker listening on :${PORT}`));
