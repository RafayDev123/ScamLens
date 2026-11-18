import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { providerStatus } from "@/db/schema";
import type { RawFinding } from "@/lib/analysis/url";
import type { SourceState, SourceStatus, ThreatMatch } from "@/lib/types";

/**
 * Threat-intelligence provider adapter architecture.
 * Each adapter: configuration check, timeout, error handling, response validation,
 * rate-limit handling, short-lived cache (where terms permit) and attribution.
 * No adapter ever fabricates a result: a missing key yields `not_configured`.
 */
export interface ProviderOutcome {
  state: SourceState;
  detail: string;
  matches: ThreatMatch[];
}

export interface ReputationProvider {
  id: string;
  name: string;
  kind: "local" | "external";
  attribution: string;
  /** Needs the submitted URL / host to be sent to a third party. */
  sendsDataExternally: boolean;
  requiresPaidPlan: string;
  docs: string;
  envVars: string[];
  isConfigured(): boolean;
  checkUrl(url: string, signal: AbortSignal): Promise<ProviderOutcome>;
  checkHost(host: string, signal: AbortSignal): Promise<ProviderOutcome>;
}

const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; outcome: ProviderOutcome }>();

async function jsonFetch(url: string, init: RequestInit, signal: AbortSignal): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { ...init, signal, redirect: "error", cache: "no-store" });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function httpProblem(status: number): ProviderOutcome | null {
  if (status === 429) return { state: "unavailable", detail: "Provider rate limit reached – try again later.", matches: [] };
  if (status === 401 || status === 403) return { state: "error", detail: "Provider rejected the configured credentials.", matches: [] };
  if (status >= 400) return { state: "error", detail: `Provider returned HTTP ${status}.`, matches: [] };
  return null;
}

/* ------------------------------ Google Web Risk ------------------------------ */
const webRiskSchema = z.object({ threat: z.object({ threatTypes: z.array(z.string()), expireTime: z.string().optional() }).optional() });

const webRisk: ReputationProvider = {
  id: "google-web-risk",
  name: "Google Web Risk",
  kind: "external",
  attribution: "Threat data © Google Web Risk API (commercial). https://cloud.google.com/web-risk",
  sendsDataExternally: true,
  requiresPaidPlan: "Commercial use is billed after the free monthly quota (Google Cloud billing account required).",
  docs: "https://cloud.google.com/web-risk/docs",
  envVars: ["WEB_RISK_API_KEY"],
  isConfigured: () => Boolean(process.env.WEB_RISK_API_KEY),
  async checkUrl(url, signal) {
    const q = new URLSearchParams();
    for (const t of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]) q.append("threatTypes", t);
    q.set("uri", url);
    q.set("key", process.env.WEB_RISK_API_KEY as string);
    const { status, body } = await jsonFetch(`https://webrisk.googleapis.com/v1/uris:search?${q.toString()}`, { method: "GET" }, signal);
    const problem = httpProblem(status);
    if (problem) return problem;
    const parsed = webRiskSchema.safeParse(body);
    if (!parsed.success) return { state: "error", detail: "Unexpected response format from provider.", matches: [] };
    const types = parsed.data.threat?.threatTypes ?? [];
    return {
      state: "ok",
      detail: types.length ? "Listed by Google Web Risk." : "Not listed in Google Web Risk lists at query time.",
      matches: types.map((t) => ({ provider: "Google Web Risk", threatType: t.replace(/_/g, " ").toLowerCase(), detail: "URL matches a Google Web Risk threat list." })),
    };
  },
  async checkHost(host, signal) {
    return this.checkUrl(`https://${host}/`, signal);
  },
};

/* --------------------------------- URLhaus ---------------------------------- */
const urlhausUrlSchema = z.object({
  query_status: z.string(),
  url_status: z.string().optional(),
  threat: z.string().nullable().optional(),
  date_added: z.string().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
const urlhausHostSchema = z.object({ query_status: z.string(), url_count: z.union([z.string(), z.number()]).optional(), urls_online: z.union([z.string(), z.number()]).optional() });

async function urlhausPost(path: string, field: string, value: string, signal: AbortSignal) {
  return jsonFetch(`https://urlhaus-api.abuse.ch/v1/${path}/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "Auth-Key": process.env.URLHAUS_API_TOKEN as string },
    body: new URLSearchParams({ [field]: value }).toString(),
  }, signal);
}

const urlhaus: ReputationProvider = {
  id: "urlhaus",
  name: "URLhaus (abuse.ch)",
  kind: "external",
  attribution: "Malware URL data from URLhaus by abuse.ch (CC0). https://urlhaus.abuse.ch",
  sendsDataExternally: true,
  requiresPaidPlan: "Free; requires an abuse.ch Auth-Key. Review abuse.ch terms for commercial use.",
  docs: "https://urlhaus-api.abuse.ch/",
  envVars: ["URLHAUS_API_TOKEN"],
  isConfigured: () => Boolean(process.env.URLHAUS_API_TOKEN),
  async checkUrl(url, signal) {
    const { status, body } = await urlhausPost("url", "url", url, signal);
    const problem = httpProblem(status);
    if (problem) return problem;
    const parsed = urlhausUrlSchema.safeParse(body);
    if (!parsed.success) return { state: "error", detail: "Unexpected response format from provider.", matches: [] };
    if (parsed.data.query_status === "ok") {
      return {
        state: "ok",
        detail: "Listed in URLhaus.",
        matches: [{ provider: "URLhaus", threatType: parsed.data.threat ?? "malware distribution", detail: `URL status: ${parsed.data.url_status ?? "unknown"}${parsed.data.date_added ? `, added ${parsed.data.date_added}` : ""}.`, metadata: { tags: parsed.data.tags ?? [] } }],
      };
    }
    if (parsed.data.query_status === "no_results") return { state: "ok", detail: "Not listed in URLhaus at query time.", matches: [] };
    return { state: "error", detail: `Provider status: ${parsed.data.query_status}`, matches: [] };
  },
  async checkHost(host, signal) {
    const { status, body } = await urlhausPost("host", "host", host, signal);
    const problem = httpProblem(status);
    if (problem) return problem;
    const parsed = urlhausHostSchema.safeParse(body);
    if (!parsed.success) return { state: "error", detail: "Unexpected response format from provider.", matches: [] };
    const count = Number(parsed.data.url_count ?? 0);
    if (parsed.data.query_status === "ok" && count > 0) {
      return { state: "ok", detail: "Host has URLs listed in URLhaus.", matches: [{ provider: "URLhaus", threatType: "malware host", detail: `${count} URL(s) on this host are listed (${Number(parsed.data.urls_online ?? 0)} online at query time).` }] };
    }
    return { state: "ok", detail: "Host not listed in URLhaus at query time.", matches: [] };
  },
};

/* ------------------------- Labelled local test fixture ------------------------ */
const FIXTURE_SUFFIX = "fixture.scamlens.test";
function fixtureEnabled() {
  return process.env.ENABLE_TEST_FIXTURES !== "false";
}
const fixture: ReputationProvider = {
  id: "test-fixture",
  name: "ScamLens test fixture (not real intelligence)",
  kind: "local",
  attribution: "Synthetic fixture for testing: any host equal to or ending in “fixture.scamlens.test”. Disable with ENABLE_TEST_FIXTURES=false.",
  sendsDataExternally: false,
  requiresPaidPlan: "n/a",
  docs: "docs/TESTING.md",
  envVars: ["ENABLE_TEST_FIXTURES"],
  isConfigured: fixtureEnabled,
  async checkUrl(url) {
    return this.checkHost(new URL(url).hostname, new AbortController().signal);
  },
  async checkHost(host) {
    const h = host.toLowerCase();
    if (h === FIXTURE_SUFFIX || h.endsWith(`.${FIXTURE_SUFFIX}`)) {
      return { state: "ok", detail: "Matched the built-in synthetic test fixture.", matches: [{ provider: "ScamLens test fixture", threatType: "synthetic test threat", detail: "This host is reserved for testing the reporting pipeline. It is not a real threat listing." }] };
    }
    return { state: "ok", detail: "No fixture match.", matches: [] };
  },
};

export const PROVIDERS: ReputationProvider[] = [webRisk, urlhaus, fixture];

export interface ReputationResult {
  sources: SourceStatus[];
  matches: ThreatMatch[];
  findings: RawFinding[];
}

async function runOne(p: ReputationProvider, mode: "url" | "host", subject: string): Promise<{ source: SourceStatus; matches: ThreatMatch[] }> {
  const checkedAt = new Date().toISOString();
  const base = { id: p.id, name: p.name, kind: p.kind, attribution: p.attribution, checkedAt } as const;
  const key = `${p.id}:${mode}:${createHash("sha256").update(subject).digest("hex")}`;
  const hitCache = cache.get(key);
  let outcome: ProviderOutcome;
  if (hitCache && Date.now() - hitCache.at < CACHE_TTL_MS) {
    outcome = hitCache.outcome;
  } else {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      outcome = mode === "url" ? await p.checkUrl(subject, ac.signal) : await p.checkHost(subject, ac.signal);
      if (outcome.state === "ok") cache.set(key, { at: Date.now(), outcome });
    } catch (e) {
      const aborted = e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message));
      outcome = { state: aborted ? "unavailable" : "error", detail: aborted ? "Provider timed out." : "Provider request failed.", matches: [] };
    } finally {
      clearTimeout(timer);
    }
    void recordStatus(p.id, outcome.state, outcome.detail);
  }
  return {
    source: { ...base, status: outcome.state, detail: outcome.detail, result: outcome.state === "ok" ? (outcome.matches.length ? "match" : "no_match") : undefined },
    matches: outcome.matches,
  };
}

async function recordStatus(id: string, state: SourceState, detail: string) {
  try {
    const ok = state === "ok";
    await db
      .insert(providerStatus)
      .values({ providerId: id, lastStatus: state, lastDetail: detail, successCount: ok ? 1 : 0, failureCount: ok ? 0 : 1 })
      .onConflictDoUpdate({
        target: providerStatus.providerId,
        set: {
          lastStatus: state,
          lastDetail: detail,
          lastCheckedAt: sql`now()`,
          successCount: ok ? sql`${providerStatus.successCount} + 1` : providerStatus.successCount,
          failureCount: ok ? providerStatus.failureCount : sql`${providerStatus.failureCount} + 1`,
        },
      });
  } catch {
    /* status tracking must never break a scan */
  }
}

export async function checkReputation(mode: "url" | "host", subject: string, consentToShare: boolean): Promise<ReputationResult> {
  const now = new Date().toISOString();
  const sources: SourceStatus[] = [];
  const matches: ThreatMatch[] = [];
  await Promise.all(
    PROVIDERS.map(async (p) => {
      const base = { id: p.id, name: p.name, kind: p.kind, attribution: p.attribution, checkedAt: now } as const;
      if (!p.isConfigured()) {
        if (p.id === "test-fixture") return; // disabled fixture is simply absent
        sources.push({ ...base, status: "not_configured", detail: `Configuration required: set ${p.envVars.join(", ")}.` });
        return;
      }
      if (p.sendsDataExternally && !consentToShare) {
        sources.push({ ...base, status: "skipped", detail: "Not queried: you did not allow sending this address to external providers." });
        return;
      }
      const r = await runOne(p, mode, subject);
      sources.push(r.source);
      matches.push(...r.matches);
    }),
  );
  sources.sort((a, b) => a.id.localeCompare(b.id));
  const findings: RawFinding[] = matches.map((m) => ({
    code: `ti.${m.provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: `Listed as ${m.threatType} by ${m.provider}`,
    severity: "critical",
    confidence: "high",
    evidence: `${m.provider}: ${m.threatType}`,
    explanation: `${m.detail} Threat-intelligence listings come from independent investigations or automated detection and are the strongest signal ScamLens can show.`,
    source: m.provider,
    action: "Do not open the link or enter any information. If you already did, change affected passwords and contact your bank if payment data was involved.",
    confirmed: m.provider !== "ScamLens test fixture",
    category: "reputation",
  }));
  return { sources, matches, findings };
}

export function providerOverview() {
  return [
    ...PROVIDERS.map((p) => ({
      id: p.id, name: p.name, kind: p.kind, configured: p.isConfigured(), sendsDataExternally: p.sendsDataExternally,
      requiresPaidPlan: p.requiresPaidPlan, envVars: p.envVars, docs: p.docs, attribution: p.attribution,
    })),
    { id: "rdap", name: "RDAP (public registries via rdap.org bootstrap)", kind: "external", configured: true, sendsDataExternally: true, requiresPaidPlan: "Free public service.", envVars: ["RDAP_BASE_URL"], docs: "https://about.rdap.org/", attribution: "Registration data from public RDAP servers." },
    { id: "dns", name: "DNS resolution (server resolver)", kind: "external", configured: true, sendsDataExternally: true, requiresPaidPlan: "n/a", envVars: [], docs: "", attribution: "Records from the server's DNS resolver." },
    { id: "tls", name: "TLS certificate inspection (direct handshake)", kind: "external", configured: true, sendsDataExternally: true, requiresPaidPlan: "n/a", envVars: [], docs: "", attribution: "Certificate presented by the target host." },
    { id: "doh-cloudflare", name: "Cloudflare DNS-over-HTTPS (DNSSEC validation flag)", kind: "external", configured: true, sendsDataExternally: true, requiresPaidPlan: "Free public resolver.", envVars: [], docs: "https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/", attribution: "DNSSEC validation status from Cloudflare public resolver." },
    { id: "local-heuristics", name: "ScamLens local heuristics", kind: "local", configured: true, sendsDataExternally: false, requiresPaidPlan: "n/a", envVars: [], docs: "docs/ARCHITECTURE.md", attribution: "ScamLens rule set." },
  ];
}
