import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { isPublicIp } from "./ip";
import { redactUrl } from "./redact";

/**
 * Restricted outbound HTTP layer. Used for redirect-chain inspection and TLS
 * checks. Guarantees:
 *  - only http/https, only ports 80/443/8080/8443
 *  - no embedded credentials
 *  - every hostname is resolved ONCE, every resolved address must be public
 *    (if any record is private the whole host is rejected)
 *  - the connection is pinned to the validated address (custom `lookup`), so a
 *    DNS-rebinding answer on a second lookup can never be used
 *  - every redirect hop is re-validated from scratch
 *  - HEAD (or header-only GET), body is never read, strict timeouts, hop limit
 */

export class BlockedTargetError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "BlockedTargetError";
  }
}

const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".intranet", ".corp", ".home", ".arpa"];

export type Resolver = (host: string) => Promise<{ address: string; family: number }[]>;

const defaultResolver: Resolver = (host) => dns.promises.lookup(host, { all: true, verbatim: true });

export async function resolvePublic(host: string, resolver: Resolver = defaultResolver): Promise<{ address: string; family: number }[]> {
  const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!bare) throw new BlockedTargetError("empty_host");
  if (isIP(bare)) {
    if (!isPublicIp(bare)) throw new BlockedTargetError("non_public_address");
    return [{ address: bare, family: isIP(bare) }];
  }
  if (bare === "localhost" || BLOCKED_SUFFIXES.some((s) => bare.endsWith(s)) || !bare.includes(".")) {
    throw new BlockedTargetError("internal_hostname");
  }
  let addrs: { address: string; family: number }[];
  try {
    addrs = await resolver(bare);
  } catch {
    throw new BlockedTargetError("dns_resolution_failed");
  }
  if (!addrs.length) throw new BlockedTargetError("no_address");
  for (const a of addrs) {
    if (!isPublicIp(a.address)) throw new BlockedTargetError("non_public_address");
  }
  return addrs;
}

export function validateOutboundUrl(raw: string | URL): URL {
  let u: URL;
  try {
    u = typeof raw === "string" ? new URL(raw) : raw;
  } catch {
    throw new BlockedTargetError("invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BlockedTargetError("unsupported_protocol");
  if (u.username || u.password) throw new BlockedTargetError("credentials_in_url");
  const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) throw new BlockedTargetError("port_not_allowed");
  return u;
}

export interface Hop {
  url: string;
  status: number | null;
  location: string | null;
  ms: number;
  error?: string;
}

export interface RedirectTrace {
  hops: Hop[];
  finalUrl: string | null;
  /** Unredacted final URL. Server-internal: must be removed before persisting or returning to clients. */
  finalRaw?: string;
  complete: boolean;
  stopReason: string;
}

export interface InspectOptions {
  maxRedirects?: number;
  totalTimeoutMs?: number;
  perHopTimeoutMs?: number;
  resolver?: Resolver;
  /** test hook – replaces the network round trip */
  requester?: HopRequester;
}

export type HopRequester = (url: URL, pinned: { address: string; family: number }, timeoutMs: number, method: "HEAD" | "GET") => Promise<{ status: number; location: string | null }>;

const realRequester: HopRequester = (url, pinned, timeoutMs, method) =>
  new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        method,
        host: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        servername: isIP(url.hostname) ? undefined : url.hostname,
        headers: { "user-agent": "ScamLensInspector/1.0 (redirect inspection; header-only)", accept: "*/*", "accept-encoding": "identity" },
        timeout: timeoutMs,
        // Pin to the already validated address: no second DNS lookup can happen.
        lookup: ((_h: string, opts: unknown, cb: (...args: unknown[]) => void) => {
          if (typeof opts === "object" && opts !== null && (opts as { all?: boolean }).all) cb(null, [{ address: pinned.address, family: pinned.family }]);
          else cb(null, pinned.address, pinned.family);
        }) as unknown as typeof dns.lookup,
      },
      (res) => {
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const status = res.statusCode ?? 0;
        res.destroy(); // never read the body
        resolve({ status, location });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => reject(e));
    req.end();
  });

export async function inspectRedirects(start: string, opts: InspectOptions = {}): Promise<RedirectTrace> {
  const maxRedirects = opts.maxRedirects ?? 6;
  const deadline = Date.now() + (opts.totalTimeoutMs ?? 10000);
  const perHop = opts.perHopTimeoutMs ?? 4000;
  const request = opts.requester ?? realRequester;
  const hops: Hop[] = [];
  let current = start;
  const seen = new Set<string>();

  for (let i = 0; i <= maxRedirects; i++) {
    const t0 = Date.now();
    const display = redactUrl(current);
    if (Date.now() > deadline) return { hops, finalUrl: hops.at(-1)?.url ?? null, complete: false, stopReason: "total_timeout" };
    if (seen.has(current)) return { hops, finalUrl: display, complete: false, stopReason: "redirect_loop" };
    seen.add(current);
    let url: URL;
    try {
      url = validateOutboundUrl(current);
      const pinned = (await resolvePublic(url.hostname, opts.resolver))[0];
      let r = await request(url, pinned, Math.min(perHop, Math.max(500, deadline - Date.now())), "HEAD");
      if (r.status === 405 || r.status === 501) r = await request(url, pinned, perHop, "GET");
      hops.push({ url: display, status: r.status, location: r.location ? redactUrl(new URL(r.location, url).toString()) : null, ms: Date.now() - t0 });
      if (r.status >= 300 && r.status < 400 && r.location) {
        if (i === maxRedirects) return { hops, finalUrl: display, complete: false, stopReason: "max_redirects" };
        current = new URL(r.location, url).toString();
        continue;
      }
      return { hops, finalUrl: display, finalRaw: current, complete: true, stopReason: "final_response" };
    } catch (e) {
      const reason = e instanceof BlockedTargetError ? `blocked:${e.reason}` : e instanceof Error ? (e.message === "timeout" ? "hop_timeout" : "connection_error") : "error";
      hops.push({ url: display, status: null, location: null, ms: Date.now() - t0, error: reason });
      return { hops, finalUrl: display, complete: false, stopReason: reason };
    }
  }
  return { hops, finalUrl: hops.at(-1)?.url ?? null, complete: false, stopReason: "max_redirects" };
}
