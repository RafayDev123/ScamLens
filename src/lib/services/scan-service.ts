import { z } from "zod";
import { analyzeEmailHeaders } from "@/lib/analysis/email-header";
import { domainFindings, lookupDns, lookupRdap, lookupTls, normalizeDomainInput } from "@/lib/analysis/domain";
import { analyzeMessage } from "@/lib/analysis/message";
import { classifyQr } from "@/lib/analysis/qr";
import { buildReport } from "@/lib/analysis/report";
import { analyzeUrlStructure, canonicalizeUrl, outboundUrl, parseSubmittedUrl, type RawFinding } from "@/lib/analysis/url";
import { checkReputation } from "@/lib/providers";
import { redactText, redactUrl, truncate } from "@/lib/security/redact";
import { inspectRedirects, type RedirectTrace } from "@/lib/security/ssrf";
import type { Report, SourceStatus, ThreatMatch } from "@/lib/types";

export class ScanInputError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export interface UrlScanOptions {
  /** User allowed sending the URL to external reputation providers. */
  shareWithProviders: boolean;
  /** User asked for header-only redirect inspection via the restricted fetcher. */
  inspectRedirects: boolean;
}

const nowIso = () => new Date().toISOString();
const localSource = (id: string, name: string, detail: string): SourceStatus => ({ id, name, kind: "local", status: "ok", detail, checkedAt: nowIso(), attribution: "ScamLens rule set (local, no data leaves the server)." });

const traceSchema = z.object({
  hops: z.array(z.object({ url: z.string(), status: z.number().nullable(), location: z.string().nullable(), ms: z.number(), error: z.string().optional() })),
  finalUrl: z.string().nullable(),
  finalRaw: z.string().optional(),
  complete: z.boolean(),
  stopReason: z.string(),
});

async function getTrace(url: string): Promise<{ trace: RedirectTrace | null; source: SourceStatus }> {
  const mode = process.env.REDIRECT_INSPECTION_MODE ?? "inline";
  const base = { id: "redirect-inspector", name: "Redirect inspector", kind: "external" as const, checkedAt: nowIso(), attribution: `Restricted header-only fetcher (${mode} mode): public IPs only, pinned DNS, ≤6 hops, no body downloaded.` };
  if (mode === "disabled") return { trace: null, source: { ...base, status: "not_configured", detail: "Redirect inspection is disabled on this deployment (REDIRECT_INSPECTION_MODE=disabled)." } };
  try {
    let trace: RedirectTrace;
    if (mode === "worker") {
      const workerUrl = process.env.REDIRECT_WORKER_URL;
      if (!workerUrl) return { trace: null, source: { ...base, status: "not_configured", detail: "Configuration required: REDIRECT_WORKER_URL." } };
      const res = await fetch(`${workerUrl.replace(/\/$/, "")}/inspect`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.REDIRECT_WORKER_SECRET ?? ""}` },
        body: JSON.stringify({ url }), signal: AbortSignal.timeout(15000), redirect: "error",
      });
      if (!res.ok) return { trace: null, source: { ...base, status: "error", detail: `Worker returned HTTP ${res.status}.` } };
      const parsed = traceSchema.safeParse(await res.json());
      if (!parsed.success) return { trace: null, source: { ...base, status: "error", detail: "Worker response did not match the expected format." } };
      trace = parsed.data;
    } else {
      trace = await inspectRedirects(url);
    }
    return { trace, source: { ...base, status: "ok", detail: trace.complete ? "Redirect chain inspected." : `Inspection stopped: ${trace.stopReason.replace(/[:_]/g, " ")}.` } };
  } catch {
    return { trace: null, source: { ...base, status: "error", detail: "Redirect inspection failed." } };
  }
}

interface UrlAnalysis {
  findings: RawFinding[];
  sources: SourceStatus[];
  matches: ThreatMatch[];
  technical: Record<string, unknown>;
  limitations: string[];
}

export async function analyzeUrl(raw: string, opts: UrlScanOptions): Promise<UrlAnalysis & { redacted: string }> {
  const parsed = parseSubmittedUrl(raw);
  if (!parsed.ok) throw new ScanInputError(parsed.code, parsed.message);
  const { url } = parsed;
  const structure = analyzeUrlStructure(url);
  const out = outboundUrl(url);
  const redacted = redactUrl(url.toString());
  const findings: RawFinding[] = [...structure.findings];
  const sources: SourceStatus[] = [localSource("local-heuristics", "ScamLens local heuristics", "URL structure, lookalike and pattern analysis completed.")];
  const limitations = [
    "The page content was not downloaded or rendered; analysis is based on the address, public reputation data and optional header-only redirect inspection.",
    "URLs that were first seen minutes ago may not appear in any threat list yet.",
  ];
  if (parsed.assumedScheme) limitations.push("No scheme was given, so https:// was assumed.");

  const rep = await checkReputation("url", out, opts.shareWithProviders);
  sources.push(...rep.sources);
  findings.push(...rep.findings);
  const matches = [...rep.matches];

  let trace: RedirectTrace | null = null;
  if (opts.inspectRedirects) {
    const r = await getTrace(out);
    sources.push(r.source);
    trace = r.trace;
    if (trace) {
      if (trace.hops.length >= 3) findings.push({ code: "url.many_redirects", title: `Link passes through ${trace.hops.length - 1} redirects`, severity: "low", confidence: "medium", evidence: trace.hops.map((h) => new URL(h.url.replace(/\[|\]/g, "")).host).join(" → "), explanation: "Redirect chains are used for tracking, but also to evade blocklists and hide the final destination.", source: "redirect-inspector", action: "Check the final destination before trusting the link.", category: "redirect" });
      if (trace.finalRaw) {
        const fin = parseSubmittedUrl(trace.finalRaw);
        if (fin.ok) {
          const finStruct = analyzeUrlStructure(fin.url);
          const startReg = structure.parts.registrable;
          if (finStruct.parts.registrable !== startReg) {
            findings.push({ code: "url.redirect_cross_domain", title: "Link ends on a different domain than it starts", severity: structure.shortener ? "info" : "low", confidence: "high", evidence: `${startReg} → ${finStruct.parts.registrable}`, explanation: structure.shortener ? "This is how shortened links normally work – the important part is whether the final domain is the one you expected." : "The link you were given does not stay on the website it started on.", source: "redirect-inspector", action: `Confirm that ${finStruct.parts.registrable} is where you expect to go.`, category: "redirect" });
            for (const f of finStruct.findings.filter((x) => x.severity !== "info" && x.severity !== "low")) findings.push({ ...f, code: `final.${f.code}`, title: `Final destination: ${f.title}`, source: "local-heuristics" });
            const finRep = await checkReputation("url", outboundUrl(fin.url), opts.shareWithProviders);
            for (const s of finRep.sources) sources.push({ ...s, id: `final-${s.id}`, name: `${s.name} (final destination)` });
            findings.push(...finRep.findings.map((f) => ({ ...f, title: `Final destination: ${f.title}` })));
            matches.push(...finRep.matches);
          }
        }
      }
    }
  }
  const redirect = trace ? { hops: trace.hops, finalUrl: trace.finalUrl, complete: trace.complete, stopReason: trace.stopReason } : null;
  const p = structure.parts;
  return {
    redacted, findings, sources, matches, limitations,
    technical: {
      originalUrl: redactUrl(parsed.original.startsWith("http") ? parsed.original : `https://${parsed.original}`),
      normalizedUrl: redactUrl(out),
      canonicalUrl: redactUrl(canonicalizeUrl(url)),
      protocol: p.scheme,
      domain: p.registrable,
      host: p.host,
      unicodeHost: p.unicodeHost,
      structure: { scheme: p.scheme, userinfo: p.userinfo ? "[credentials]@" : null, subdomain: p.subdomain, registrable: p.registrable, port: p.port, path: redactUrl(`https://x${p.path}`).replace(/^https:\/\/x/, "") || "/", query: p.query ? redactUrl(`https://x/${p.query}`).replace(/^https:\/\/x\//, "") : "", fragment: p.fragment ? "#[fragment]" : "" },
      isIpAddress: p.isIp,
      shortener: structure.shortener,
      redirect,
      redirectRequested: opts.inspectRedirects,
      providersQueried: opts.shareWithProviders,
    },
  };
}

export async function scanUrl(raw: string, opts: UrlScanOptions): Promise<Report> {
  const a = await analyzeUrl(raw, opts);
  return buildReport({ type: "url", subject: a.redacted, findings: a.findings, sources: a.sources, threatMatches: a.matches, technical: a.technical, limitations: a.limitations });
}

export async function scanMessage(text: string): Promise<Report> {
  const t = text.trim();
  if (!t) throw new ScanInputError("empty", "Paste a message to analyze.");
  const a = analyzeMessage(t);
  const urls = a.urls.map((u) => ({ display: u.display, host: u.host, localRisk: u.localRisk, indicators: u.indicators }));
  return buildReport({
    type: "message",
    subject: truncate(a.redacted.replace(/\s+/g, " "), 240),
    findings: a.findings,
    sources: [localSource("local-message-rules", "ScamLens message rules", `Pattern analysis (${a.language}) ran locally on the server. Message text was not sent to any third party.`)],
    technical: { language: a.language, redactedMessage: truncate(a.redacted, 3000), characters: a.length, redactionApplied: true, linksFound: a.urls.length, rulesetLanguages: ["English", "Urdu", "Roman Urdu"] },
    embeddedUrls: urls,
    localIsSufficient: true,
    enoughInput: t.length >= 15,
    limitations: [
      "Message analysis is pattern-based and runs locally. A scammer can phrase a message in a way no rule matches.",
      "Numbers, e-mail addresses and link parameters were redacted before analysis and storage.",
      ...(t.length < 15 ? ["The message is very short, so the result is not meaningful."] : []),
    ],
  });
}

export async function scanQr(content: string, opts: UrlScanOptions): Promise<Report> {
  const c = content.trim();
  if (!c) throw new ScanInputError("empty", "No QR content supplied.");
  const cls = classifyQr(c);
  // Never echo Wi-Fi passwords into reports, even redacted-by-pattern.
  const safeContent = cls.type === "wifi" ? c.replace(/(^|;|:)(P:)((?:\\.|[^;])*)/i, "$1$2[hidden]") : c;
  const sources: SourceStatus[] = [localSource("local-qr-analysis", "ScamLens QR content analysis", "Content type classification and safety checks ran locally.")];
  const findings: RawFinding[] = [...cls.findings];
  let matches: ThreatMatch[] = [];
  let urlTechnical: Record<string, unknown> | null = null;
  let limitations: string[] = [
    "The QR image was decoded in your browser and never uploaded. Only the decoded text was analyzed.",
    "A QR code cannot prove its destination is safe – it only encodes text. Physical QR stickers may be placed over genuine ones.",
  ];
  let subject = redactText(safeContent);
  if (cls.url) {
    try {
      const a = await analyzeUrl(cls.url, opts);
      sources.push(...a.sources.filter((s) => s.id !== "local-heuristics"), { ...a.sources[0], id: "local-heuristics" });
      findings.push(...a.findings);
      matches = a.matches;
      limitations = [...limitations, ...a.limitations];
      urlTechnical = a.technical;
      subject = a.redacted;
    } catch (e) {
      if (e instanceof ScanInputError) findings.push({ code: "qr.invalid_url", title: "QR contains a link-like value that is not a valid URL", severity: "low", confidence: "medium", evidence: truncate(redactText(c), 120), explanation: e.message, source: "local-qr-analysis", action: "Do not open it.", category: "qr" });
      else throw e;
    }
  }
  return buildReport({
    type: "qr", subject: truncate(subject, 300), findings, sources, threatMatches: matches,
    technical: { contentType: cls.type, contentTypeLabel: cls.label, fields: cls.fields, decodedContent: truncate(redactText(safeContent), 500), ...(urlTechnical ? { url: urlTechnical } : {}) },
    limitations,
    localIsSufficient: !cls.url,
    enoughInput: true,
  });
}

export async function scanDomain(input: string, opts: { shareWithProviders: boolean }): Promise<Report> {
  const n = normalizeDomainInput(input);
  if (!n.ok) throw new ScanInputError("invalid_domain", n.message);
  const [rdap, dnsRes, tlsRes, rep] = await Promise.all([lookupRdap(n.ascii), lookupDns(n.ascii), lookupTls(n.ascii), checkReputation("host", n.ascii, opts.shareWithProviders)]);
  const findings = [...domainFindings(n.ascii, n.unicode, rdap.info, dnsRes.info, tlsRes.info), ...rep.findings];
  const sources = [localSource("local-heuristics", "ScamLens lookalike analysis", "Lookalike, typosquatting and homograph checks completed."), rdap.source, dnsRes.source, tlsRes.source, ...rep.sources];
  const noRecords = rdap.info === null && dnsRes.info.a.length + dnsRes.info.aaaa.length + dnsRes.info.ns.length === 0;
  const limitations = [
    "RDAP data is provided by registries and registrars; fields are often redacted for privacy. Missing or redacted fields are normal and not suspicious by themselves.",
    "A recently registered domain is not automatically malicious, and an old domain is not automatically trustworthy.",
    "Only passive, standards-based queries were made (RDAP, DNS, one TLS handshake). No port scanning or active reconnaissance was performed.",
    ...(noRecords ? ["No registration or DNS data was found – the domain may not exist, may be unregistered or the data sources may be unreachable."] : []),
  ];
  const report = buildReport({
    type: "domain", subject: n.unicode === n.ascii ? n.ascii : `${n.unicode} (${n.ascii})`, findings, sources, threatMatches: rep.matches,
    technical: { domain: n.ascii, unicodeDomain: n.unicode, registrable: n.ascii, rdap: rdap.info, dns: dnsRes.info, tls: tlsRes.info, dataAvailability: { rdap: rdap.info ? "available" : "unavailable", dns: dnsRes.source.detail.startsWith("DNS records retrieved") ? "available" : "no records", tls: tlsRes.info?.available ? "available" : "no HTTPS service / not reachable" } },
    limitations,
    enoughInput: !noRecords,
  });
  // A domain with no data at all cannot be judged
  if (noRecords && report.verdict === "no_known_threat") {
    report.verdict = "inconclusive";
    report.verdictLabel = "Inconclusive";
    report.summary = "ScamLens could not find registration or DNS data for this domain, so no assessment is possible.";
  }
  return report;
}

export async function scanEmailHeaders(raw: string): Promise<Report> {
  const t = raw.trim();
  if (t.length < 20) throw new ScanInputError("empty", "Paste the full raw email headers to analyze.");
  const a = analyzeEmailHeaders(t);
  if (!a.ok) throw new ScanInputError("not_headers", "This does not look like raw email headers (expected lines such as “From:” and “Received:”).");
  return buildReport({
    type: "email-header", subject: `Email headers (${a.technical.headerCount} fields, ${a.technical.receivedHops} hops)`, findings: a.findings,
    sources: [localSource("local-header-analysis", "ScamLens header analysis", "Headers parsed locally; no content or addresses were sent to third parties.")],
    technical: a.technical, localIsSufficient: true, enoughInput: Object.keys(a.technical).length > 0,
    limitations: [
      "Headers can be forged. Only the Authentication-Results and Received lines added by YOUR receiving mail server are reliable; lines added earlier by the sender can be fake.",
      "SPF, DKIM and DMARC results show whether a message was authenticated, not whether the sender is trustworthy – scammers also authenticate their own domains.",
      "ScamLens does not need mailbox access or passwords and never asks for them.",
    ],
  });
}
