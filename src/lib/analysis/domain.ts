import dns from "node:dns";
import tls from "node:tls";
import { isIP } from "node:net";
import { domainToASCII, domainToUnicode } from "node:url";
import { parse } from "tldts";
import { z } from "zod";
import { BlockedTargetError, resolvePublic } from "@/lib/security/ssrf";
import type { SourceStatus } from "@/lib/types";
import type { RawFinding } from "./url";
import { findLookalikes } from "./lookalike";

export function normalizeDomainInput(input: string): { ok: true; ascii: string; unicode: string } | { ok: false; message: string } {
  let v = input.trim().toLowerCase();
  v = v.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/^\*\./, "").replace(/\.$/, "");
  if (!v) return { ok: false, message: "Enter a domain name such as example.com." };
  if (v.length > 253) return { ok: false, message: "Domain names are limited to 253 characters." };
  if (v.includes("@")) return { ok: false, message: "Enter only the domain (the part after the @)." };
  const ascii = domainToASCII(v);
  if (!ascii || isIP(ascii)) return { ok: false, message: "Enter a domain name, not an IP address." };
  const p = parse(ascii);
  if (!p.domain || !p.isIcann) return { ok: false, message: "This is not a registrable public domain name." };
  if (!/^[a-z0-9.-]+$/.test(ascii) || ascii.split(".").some((l) => !l || l.length > 63 || l.startsWith("-") || l.endsWith("-"))) return { ok: false, message: "The domain contains invalid characters." };
  return { ok: true, ascii, unicode: domainToUnicode(ascii) };
}

const rdapSchema = z.object({
  ldhName: z.string().optional(),
  status: z.array(z.string()).optional(),
  events: z.array(z.object({ eventAction: z.string(), eventDate: z.string() })).optional(),
  nameservers: z.array(z.object({ ldhName: z.string().optional() })).optional(),
  entities: z.array(z.any()).optional(),
  secureDNS: z.object({ delegationSigned: z.boolean().optional() }).optional(),
});

export interface RdapInfo {
  registered: string | null;
  updated: string | null;
  expires: string | null;
  registrar: string | null;
  status: string[];
  nameservers: string[];
  redacted: boolean;
  delegationSigned: boolean | null;
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export async function lookupRdap(domain: string): Promise<{ source: SourceStatus; info: RdapInfo | null }> {
  const checkedAt = new Date().toISOString();
  const base = { id: "rdap", name: "RDAP registration data", kind: "external" as const, checkedAt, attribution: "Public RDAP servers (RFC 7480 family) via the rdap.org bootstrap redirector." };
  const root = (process.env.RDAP_BASE_URL || "https://rdap.org").replace(/\/$/, "");
  try {
    const res = await timedFetch(`${root}/domain/${encodeURIComponent(domain)}`, { headers: { accept: "application/rdap+json, application/json", "user-agent": "ScamLens/1.0 (domain intelligence; RDAP client)" }, redirect: "follow" }, 9000);
    if (res.status === 404) return { source: { ...base, status: "ok", detail: "No RDAP record was returned for this name (it may be unregistered or its registry may not publish RDAP)." }, info: null };
    if (res.status === 429) return { source: { ...base, status: "unavailable", detail: "RDAP service rate-limited the request." }, info: null };
    if (!res.ok) return { source: { ...base, status: "error", detail: `RDAP server returned HTTP ${res.status}.` }, info: null };
    const parsed = rdapSchema.safeParse(await res.json());
    if (!parsed.success) return { source: { ...base, status: "error", detail: "RDAP response did not match the expected format." }, info: null };
    const d = parsed.data;
    const ev = (a: string) => d.events?.find((e) => e.eventAction.toLowerCase() === a)?.eventDate ?? null;
    let registrar: string | null = null;
    let redacted = false;
    for (const ent of d.entities ?? []) {
      const roles: string[] = Array.isArray(ent?.roles) ? ent.roles : [];
      const vcard: unknown[] = Array.isArray(ent?.vcardArray?.[1]) ? ent.vcardArray[1] : [];
      const fn = (vcard.find((x) => Array.isArray(x) && x[0] === "fn") as unknown[] | undefined)?.[3];
      if (roles.includes("registrar") && typeof fn === "string") registrar = fn;
      if (JSON.stringify(ent).toLowerCase().includes("redacted")) redacted = true;
      if (roles.some((r) => ["registrant", "administrative", "technical"].includes(r))) redacted = redacted || true;
    }
    return {
      source: { ...base, status: "ok", detail: "Registration data retrieved." },
      info: {
        registered: ev("registration"), updated: ev("last changed"), expires: ev("expiration"), registrar,
        status: d.status ?? [], nameservers: (d.nameservers ?? []).map((n) => n.ldhName ?? "").filter(Boolean),
        redacted, delegationSigned: d.secureDNS?.delegationSigned ?? null,
      },
    };
  } catch (e) {
    const timeout = e instanceof Error && /abort/i.test(e.message);
    return { source: { ...base, status: timeout ? "unavailable" : "error", detail: timeout ? "RDAP lookup timed out." : "RDAP lookup failed (network or registry error)." }, info: null };
  }
}

export interface DnsInfo {
  a: string[]; aaaa: string[]; mx: { exchange: string; priority: number }[]; ns: string[]; txt: string[]; caa: string[];
  spf: string | null; dmarc: string | null; dnssecValidated: boolean | null;
}

async function safe<T>(p: Promise<T>, empty: T): Promise<T> {
  try {
    return await Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("dns_timeout")), 5000))]);
  } catch {
    return empty;
  }
}

export async function lookupDns(domain: string): Promise<{ source: SourceStatus; info: DnsInfo }> {
  const checkedAt = new Date().toISOString();
  const r = dns.promises;
  const [a, aaaa, mx, ns, txt, caa, dmarcTxt] = await Promise.all([
    safe(r.resolve4(domain), [] as string[]),
    safe(r.resolve6(domain), [] as string[]),
    safe(r.resolveMx(domain), [] as dns.MxRecord[]),
    safe(r.resolveNs(domain), [] as string[]),
    safe(r.resolveTxt(domain), [] as string[][]),
    safe(r.resolveCaa(domain), [] as dns.CaaRecord[]),
    safe(r.resolveTxt(`_dmarc.${domain}`), [] as string[][]),
  ]);
  const txtFlat = txt.map((t) => t.join(""));
  const info: DnsInfo = {
    a, aaaa, mx: mx.map((m) => ({ exchange: m.exchange, priority: m.priority })).sort((x, y) => x.priority - y.priority), ns: ns.sort(), txt: txtFlat.slice(0, 20),
    caa: caa.map((c) => `${c.critical ? "critical " : ""}${"issue" in c ? `issue ${c.issue}` : "issuewild" in c ? `issuewild ${c.issuewild}` : "iodef" in c ? `iodef ${c.iodef}` : "record"}`),
    spf: txtFlat.find((t) => /^v=spf1/i.test(t)) ?? null,
    dmarc: dmarcTxt.map((t) => t.join("")).find((t) => /^v=DMARC1/i.test(t)) ?? null,
    dnssecValidated: null,
  };
  // DNSSEC validation flag from a validating public resolver (DoH JSON)
  try {
    const res = await timedFetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A&do=1`, { headers: { accept: "application/dns-json" } }, 5000);
    if (res.ok) {
      const j = z.object({ AD: z.boolean().optional(), Status: z.number().optional() }).safeParse(await res.json());
      if (j.success && j.data.Status === 0) info.dnssecValidated = Boolean(j.data.AD);
    }
  } catch {
    /* optional signal */
  }
  const any = a.length + aaaa.length + mx.length + ns.length + txtFlat.length > 0;
  return { source: { id: "dns", name: "DNS records", kind: "external", status: any ? "ok" : "ok", detail: any ? "DNS records retrieved from the server resolver." : "Resolver returned no records for this name (may not exist or has no public records).", checkedAt, attribution: "Server DNS resolver; DNSSEC flag from Cloudflare DNS-over-HTTPS." }, info };
}

export interface TlsInfo {
  available: boolean; issuer: string | null; subject: string | null; validFrom: string | null; validTo: string | null;
  daysRemaining: number | null; san: string[]; hostnameMatch: boolean | null; trusted: boolean | null; authError: string | null; protocol: string | null;
}

export async function lookupTls(domain: string): Promise<{ source: SourceStatus; info: TlsInfo | null }> {
  const checkedAt = new Date().toISOString();
  const base = { id: "tls", name: "TLS certificate", kind: "external" as const, checkedAt, attribution: "Certificate presented during a single TLS handshake on port 443." };
  try {
    const addrs = await resolvePublic(domain);
    const pinned = addrs[0];
    const info = await new Promise<TlsInfo>((resolve, reject) => {
      const socket = tls.connect({
        host: pinned.address, port: 443, servername: domain, rejectUnauthorized: false, timeout: 6000, ALPNProtocols: ["http/1.1"],
      });
      socket.once("secureConnect", () => {
        const c = socket.getPeerCertificate();
        const err = socket.authorizationError;
        const validTo = c?.valid_to ? new Date(c.valid_to) : null;
        const san = (c?.subjectaltname ?? "").split(",").map((s) => s.trim().replace(/^DNS:/, "")).filter(Boolean).slice(0, 40);
        const mismatch = c && Object.keys(c).length ? tls.checkServerIdentity(domain, c) : new Error("no certificate");
        resolve({
          available: true,
          issuer: (c?.issuer?.O as string | undefined) ?? (c?.issuer?.CN as string | undefined) ?? null,
          subject: (c?.subject?.CN as string | undefined) ?? null,
          validFrom: c?.valid_from ? new Date(c.valid_from).toISOString() : null,
          validTo: validTo ? validTo.toISOString() : null,
          daysRemaining: validTo ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000) : null,
          san, hostnameMatch: mismatch === undefined, trusted: socket.authorized, authError: err ? String(err) : null, protocol: socket.getProtocol(),
        });
        socket.end();
      });
      socket.once("timeout", () => { socket.destroy(); reject(new Error("timeout")); });
      socket.once("error", (e) => reject(e));
    });
    return { source: { ...base, status: "ok", detail: "Certificate retrieved." }, info };
  } catch (e) {
    if (e instanceof BlockedTargetError) return { source: { ...base, status: "skipped", detail: `Not contacted: ${e.reason.replace(/_/g, " ")}.` }, info: null };
    const msg = e instanceof Error ? e.message : "";
    return { source: { ...base, status: "ok", detail: msg === "timeout" ? "HTTPS port did not answer within the time limit." : "No HTTPS service answered on port 443 (or the handshake failed)." }, info: { available: false, issuer: null, subject: null, validFrom: null, validTo: null, daysRemaining: null, san: [], hostnameMatch: null, trusted: null, authError: null, protocol: null } };
  }
}

export function domainFindings(domain: string, unicode: string, rdap: RdapInfo | null, dnsInfo: DnsInfo, tlsInfo: TlsInfo | null): RawFinding[] {
  const out: RawFinding[] = [];
  const push = (f: Omit<RawFinding, "source">) => out.push({ source: "domain-analysis", ...f });
  const now = Date.now();
  if (rdap?.registered) {
    const age = Math.floor((now - new Date(rdap.registered).getTime()) / 86_400_000);
    if (age >= 0 && age < 30) push({ code: "domain.very_new", title: `Domain registered only ${age} day(s) ago`, severity: "low", confidence: "medium", evidence: `Registered ${rdap.registered.slice(0, 10)}`, explanation: "Many scam domains are new. But new domains are also normal for new businesses, so age is only a weak signal that matters in combination with others.", action: "Look for independent evidence the organization exists before trusting it.", category: "domain" });
    else if (age >= 30 && age < 90) push({ code: "domain.recent", title: `Domain registered ${age} days ago`, severity: "info", confidence: "low", evidence: `Registered ${rdap.registered.slice(0, 10)}`, explanation: "Recently registered, but not unusual by itself.", action: "No action required on this signal alone.", category: "domain" });
  }
  if (rdap?.expires) {
    const left = Math.floor((new Date(rdap.expires).getTime() - now) / 86_400_000);
    if (left < 0) push({ code: "domain.expired", title: "Registration expiry date has passed", severity: "low", confidence: "medium", evidence: `Expired ${rdap.expires.slice(0, 10)}`, explanation: "An expired registration may be in a grace period or re-registered by someone else. Registry data can lag behind.", action: "Do not rely on this domain for important communications.", category: "domain" });
  }
  if (rdap?.status.some((s) => /hold|pendingdelete|redemption/i.test(s))) push({ code: "domain.status_hold", title: "Registry status indicates a hold or deletion state", severity: "low", confidence: "medium", evidence: rdap.status.join(", "), explanation: "Domains can be put on hold for non-payment, disputes or abuse handling. The status alone does not tell you why.", action: "Treat the site as unavailable or unreliable.", category: "domain" });
  if (tlsInfo?.available) {
    if (tlsInfo.hostnameMatch === false) push({ code: "tls.hostname_mismatch", title: "Certificate does not match the domain name", severity: "medium", confidence: "high", evidence: `Certificate covers: ${tlsInfo.san.slice(0, 4).join(", ") || tlsInfo.subject || "unknown"}`, explanation: "Browsers warn when the certificate was issued for a different name. Misconfiguration is the common cause, but it also happens with sites served by an unrelated host.", action: "Do not enter credentials on a page that triggers a certificate warning.", category: "tls" });
    if (tlsInfo.daysRemaining !== null && tlsInfo.daysRemaining < 0) push({ code: "tls.expired", title: "TLS certificate has expired", severity: "medium", confidence: "high", evidence: `Expired ${tlsInfo.validTo?.slice(0, 10)}`, explanation: "An expired certificate is usually a maintenance lapse rather than proof of fraud, but browsers will warn visitors and the connection cannot be fully trusted.", action: "Avoid submitting data until the site renews its certificate.", category: "tls" });
    else if (tlsInfo.trusted === false && tlsInfo.hostnameMatch !== false && !(tlsInfo.daysRemaining !== null && tlsInfo.daysRemaining < 0)) push({ code: "tls.untrusted", title: "Certificate chain is not trusted by this server", severity: "medium", confidence: "medium", evidence: tlsInfo.authError ?? "chain validation failed", explanation: "The certificate could not be verified against trusted authorities (self-signed or incomplete chain).", action: "Be cautious with any information entered on this site.", category: "tls" });
  }
  const look = findLookalikes(domain);
  for (const m of look.matches) {
    push({
      code: `domain.lookalike.${m.kind}`,
      title: m.kind === "punycode" ? "Internationalized (punycode) domain" : m.kind === "misleading_subdomain" ? `Misleading subdomain mentions “${m.brand}”` : `Domain resembles “${m.brand}”`,
      severity: m.severity, confidence: m.kind === "different_tld" || m.kind === "additional_words" ? "low" : "medium",
      evidence: m.kind === "punycode" ? `${domain} → ${unicode}` : `${look.registrable} ≈ ${m.officialDomain}`,
      explanation: `${m.detail} Similarity never proves affiliation or intent.`,
      action: "Confirm you are on the organization's official site by typing its address yourself.", category: "impersonation",
    });
  }
  if (dnsInfo.mx.length && !dnsInfo.spf && !dnsInfo.dmarc) push({ code: "dns.no_email_auth", title: "Domain receives mail but publishes no SPF or DMARC", severity: "info", confidence: "medium", evidence: "No v=spf1 / v=DMARC1 TXT records found", explanation: "Without these records anyone can more easily forge email from this domain. Many small domains lack them; it is not proof of wrongdoing.", action: "Be skeptical of emails claiming to come from this domain.", category: "dns" });
  return out;
}
