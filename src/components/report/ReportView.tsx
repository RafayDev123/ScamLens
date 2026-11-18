"use client";

import { format } from "date-fns";
import { AlertTriangle, Check, Clipboard, Download, FileJson, Link2, Printer, Save, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { btn, Card, SEVERITY_VAR, SeverityChip } from "@/components/ui";
import { reportSummaryText } from "@/lib/report-text";
import type { Finding, Report, SourceStatus } from "@/lib/types";
import { DomainTimeline, Meter, RedirectFlow, RiskGauge, UrlInspector, type Hop, type StructureParts, type TimelineEvent } from "./visuals";

export interface ReportMeta {
  saved: boolean;
  expiresAt: string | null;
  shared: { active: boolean; expiresAt: string | null };
}

const SRC_TONE: Record<SourceStatus["status"], string> = { ok: "text-ok", unavailable: "text-warn", not_configured: "text-warn", error: "text-danger", skipped: "text-muted" };
const SRC_LABEL: Record<SourceStatus["status"], string> = { ok: "Responded", unavailable: "Unavailable", not_configured: "Configuration required", error: "Error", skipped: "Not run" };

function Section({ id, title, children, kicker }: { id: string; title: string; kicker: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="print-card">
      <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent">{kicker}</p>
      <h2 id={id} className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const c = SEVERITY_VAR[f.severity];
  return (
    <article className="print-card relative overflow-hidden rounded-lg border border-line bg-surface p-4 pl-5" aria-label={`${f.severity} finding: ${f.title}`}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: c }} />
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip severity={f.severity} />
        <h3 className="text-[15px] font-semibold">{f.title}</h3>
      </div>
      <p className="mt-1 text-xs text-muted">Confidence <b className="text-fg">{f.confidence}</b> · Source <b className="text-fg">{f.source}</b> · <time dateTime={f.timestamp}>{format(new Date(f.timestamp), "yyyy-MM-dd HH:mm:ss")}</time></p>
      <div className="bracket mono mt-3 whitespace-pre-wrap break-words rounded-md border border-line bg-panel px-3 py-2 text-[13px]" aria-label="Evidence">{f.evidence}</div>
      <p className="mt-3 text-sm text-muted">{f.explanation}</p>
      <p className="mt-2 flex gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span><b>Recommended:</b> {f.action}</span></p>
    </article>
  );
}

function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[170px_1fr]">
      {rows.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs uppercase tracking-wide text-muted sm:pt-0.5">{k}</dt>
          <dd className="mono min-w-0 break-words text-[13px]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

type Tech = Record<string, unknown>;

function Highlighted({ text, marks }: { text: string; marks: string[] }) {
  const ranges: [number, number][] = [];
  const lower = text.toLowerCase();
  for (const m of marks) {
    const i = lower.indexOf(m.toLowerCase());
    if (i >= 0 && m.length > 2) ranges.push([i, i + m.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const out: ReactNode[] = [];
  let pos = 0;
  merged.forEach(([s, e], i) => {
    if (s > pos) out.push(text.slice(pos, s));
    out.push(<mark key={i} className="rounded-sm bg-warn/25 px-0.5 text-fg underline decoration-warn decoration-2 underline-offset-2">{text.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(text.slice(pos));
  return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{out}</p>;
}

function Technical({ r }: { r: Report }) {
  const [nowMs] = useState(() => Date.now());
  const t = r.technical as Tech;
  const url = (r.type === "qr" ? (t.url as Tech | undefined) : t) as Tech | undefined;
  const blocks: ReactNode[] = [];

  if ((r.type === "url" || r.type === "qr") && url?.structure) {
    const redirect = url.redirect as { hops: Hop[]; finalUrl: string | null; complete: boolean; stopReason: string } | null;
    blocks.push(
      <Card key="u" className="p-4">
        <h3 className="mb-3 text-sm font-semibold">URL structure inspector</h3>
        <UrlInspector parts={url.structure as StructureParts} />
        <div className="mt-5"><KV rows={[
          ["Original (redacted)", String(url.originalUrl)],
          ["Normalized", String(url.normalizedUrl)],
          ["Canonical", String(url.canonicalUrl)],
          ["Domain", String(url.domain)],
          ["Hostname", url.unicodeHost !== url.host ? `${url.unicodeHost} (${url.host})` : String(url.host)],
          ["Protocol", String(url.protocol)],
          ["Shortener", url.shortener ? "yes" : "no"],
          ["Reputation providers", url.providersQueried ? "Address shared with configured providers (with consent)" : "Not queried (no consent given)"],
        ]} /></div>
      </Card>,
    );
    blocks.push(
      <Card key="r" className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Redirect flow</h3>
        {redirect ? <RedirectFlow {...redirect} /> : <p className="text-sm text-muted">{url.redirectRequested ? "Redirect inspection was requested but returned no data." : "Redirect inspection was not requested. Enable “Expand redirects” to trace the chain without opening the page in your browser."}</p>}
      </Card>,
    );
  }
  if (r.type === "qr") {
    blocks.push(<Card key="q" className="p-4"><h3 className="mb-3 text-sm font-semibold">QR content</h3><KV rows={[["Content type", String(t.contentTypeLabel)], ["Decoded (redacted)", String(t.decodedContent)], ...Object.entries((t.fields as Record<string, string>) ?? {}).map(([k, v]) => [k, v] as [string, ReactNode])]} /></Card>);
  }
  if (r.type === "message") {
    const msg = String(t.redactedMessage ?? "");
    blocks.push(
      <Card key="m" className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Message with highlighted indicators</h3>
        <div className="rounded-md border border-line bg-panel p-3"><Highlighted text={msg} marks={r.findings.map((f) => f.evidence)} /></div>
        <p className="mt-2 text-xs text-muted">Numbers, e-mail addresses and link secrets are redacted. Language detected: <b className="text-fg">{String(t.language)}</b>. Processed locally – not sent to any third party.</p>
        {r.embeddedUrls && r.embeddedUrls.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Links found</h4>
            <ul className="space-y-2">{r.embeddedUrls.map((u, i) => <li key={i} className="rounded-md border border-line p-2 text-sm"><span className="mono break-all text-[13px]">{u.display}</span><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted"><SeverityChip severity={u.localRisk} /> local structure check{u.indicators.length ? `: ${u.indicators.slice(0, 3).join("; ")}` : ": no structural warning"}</div></li>)}</ul>
          </div>
        )}
      </Card>,
    );
  }
  if (r.type === "domain") {
    const rdap = t.rdap as { registered: string | null; updated: string | null; expires: string | null; registrar: string | null; status: string[]; nameservers: string[]; redacted: boolean; delegationSigned: boolean | null } | null;
    const dns = t.dns as { a: string[]; aaaa: string[]; mx: { exchange: string; priority: number }[]; ns: string[]; txt: string[]; caa: string[]; spf: string | null; dmarc: string | null; dnssecValidated: boolean | null };
    const tls = t.tls as { available: boolean; issuer: string | null; subject: string | null; validFrom: string | null; validTo: string | null; daysRemaining: number | null; san: string[]; hostnameMatch: boolean | null; trusted: boolean | null; authError: string | null; protocol: string | null } | null;
    const events: TimelineEvent[] = [];
    if (rdap?.registered) events.push({ label: "Domain registered", date: rdap.registered, tone: "ok" });
    if (rdap?.updated) events.push({ label: "Registration last changed", date: rdap.updated, tone: "muted" });
    if (rdap?.expires) events.push({ label: "Registration expires", date: rdap.expires, tone: new Date(rdap.expires).getTime() < nowMs ? "warn" : "muted" });
    if (tls?.validFrom) events.push({ label: "TLS certificate valid from", date: tls.validFrom, tone: "ok" });
    if (tls?.validTo) events.push({ label: "TLS certificate expires", date: tls.validTo, tone: (tls.daysRemaining ?? 1) < 0 ? "warn" : "muted" });
    blocks.push(
      <Card key="tl" className="p-4"><h3 className="mb-3 text-sm font-semibold">Domain intelligence timeline</h3><DomainTimeline events={events} now={nowMs} /></Card>,
      <Card key="reg" className="p-4"><h3 className="mb-3 text-sm font-semibold">Registration (RDAP)</h3>
        {rdap ? <KV rows={[["Registrar", rdap.registrar ?? "not published"], ["Status", rdap.status.join(", ") || "not published"], ["Nameservers", rdap.nameservers.join(", ") || "not published"], ["Registrant data", rdap.redacted ? "privacy-redacted (normal)" : "not published"], ["Delegation signed", rdap.delegationSigned === null ? "unknown" : String(rdap.delegationSigned)]]} /> : <p className="text-sm text-muted">No RDAP record was available. This is not suspicious by itself – some registries do not publish RDAP.</p>}
      </Card>,
      <Card key="dns" className="p-4"><h3 className="mb-3 text-sm font-semibold">DNS records</h3>
        <KV rows={[["A", dns.a.join(", ") || "none"], ["AAAA", dns.aaaa.join(", ") || "none"], ["MX", dns.mx.map((m) => `${m.priority} ${m.exchange}`).join(", ") || "none"], ["NS", dns.ns.join(", ") || "none"], ["CAA", dns.caa.join(", ") || "none"], ["SPF", dns.spf ?? "not found"], ["DMARC", dns.dmarc ?? "not found"], ["DNSSEC", dns.dnssecValidated === null ? "unknown" : dns.dnssecValidated ? "validated by resolver" : "not validated"], ["TXT", dns.txt.join(" | ") || "none"]]} />
      </Card>,
      <Card key="tls" className="p-4"><h3 className="mb-3 text-sm font-semibold">TLS certificate</h3>
        {tls?.available ? <KV rows={[["Issuer", tls.issuer], ["Subject", tls.subject], ["Valid", `${tls.validFrom?.slice(0, 10)} → ${tls.validTo?.slice(0, 10)} (${tls.daysRemaining} days left)`], ["Hostname match", String(tls.hostnameMatch)], ["Chain trusted", String(tls.trusted)], ["Protocol", tls.protocol], ["SAN", tls.san.join(", ")]]} /> : <p className="text-sm text-muted">No HTTPS service answered on port 443. That alone is not proof of wrongdoing.</p>}
        <p className="mt-2 text-xs text-muted">A valid certificate only proves the connection is encrypted to the named host – not that the site is honest.</p>
      </Card>,
    );
  }
  if (r.type === "email-header") {
    const auth = t.authentication as { mechanism: string; result: string; detail: string }[];
    const chain = t.receivedChain as { hop: number; from: string | null; by: string | null; date: string | null }[];
    blocks.push(
      <Card key="a" className="p-4"><h3 className="mb-3 text-sm font-semibold">Authentication results</h3>
        {auth.length ? <ul className="grid gap-2 sm:grid-cols-3">{auth.map((a) => <li key={a.mechanism} className="rounded-md border border-line p-3"><p className="text-xs uppercase text-muted">{a.mechanism}</p><p className={`mono text-lg font-semibold ${a.result === "pass" ? "text-ok" : a.result === "none" || a.result === "neutral" ? "text-muted" : "text-danger"}`}>{a.result}</p><p className="mono truncate text-[11px] text-muted" title={a.detail}>{a.detail}</p></li>)}</ul> : <p className="text-sm text-muted">No SPF/DKIM/DMARC results were present in the supplied headers.</p>}
      </Card>,
      <Card key="h" className="p-4"><h3 className="mb-3 text-sm font-semibold">Addresses &amp; Received chain</h3>
        <KV rows={[["From", String(t.from ?? "—")], ["Reply-To", String(t.replyTo ?? "—")], ["Return-Path", String(t.returnPath ?? "—")], ["Message-ID domain", String(t.messageIdDomain ?? "—")], ["DKIM domains", (t.dkimSigningDomains as string[]).join(", ") || "—"]]} />
        {chain.length > 0 && <ol className="mt-4 space-y-2 border-l border-line pl-4">{chain.map((h) => <li key={h.hop} className="text-xs"><span className="mono text-fg">hop {h.hop}</span> <span className="text-muted">from</span> <span className="mono">{h.from ?? "?"}</span> <span className="text-muted">by</span> <span className="mono">{h.by ?? "?"}</span><div className="text-muted">{h.date}</div></li>)}</ol>}
      </Card>,
    );
  }
  blocks.push(
    <details key="json" className="rounded-lg border border-line bg-surface p-4 no-print">
      <summary className="cursor-pointer text-sm font-medium">Raw technical data (JSON)</summary>
      <pre className="mono mt-3 max-h-80 overflow-auto rounded-md bg-panel p-3 text-xs">{JSON.stringify(r.technical, null, 2)}</pre>
    </details>,
  );
  return <div className="space-y-4">{blocks}</div>;
}

export function ReportView({ report, reportId, meta: initialMeta, signedIn, readOnly = false }: { report: Report; reportId?: string; meta?: ReportMeta; signedIn: boolean; readOnly?: boolean }) {
  const [meta, setMeta] = useState<ReportMeta | undefined>(initialMeta);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const id = reportId ?? report.id;

  async function api(path: string, init: RequestInit) {
    const res = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.error?.message ?? `Request failed (${res.status})`);
    }
    return res;
  }
  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Action failed." });
    } finally {
      setBusy(null);
    }
  }
  const download = (format: "pdf" | "json") => run(format, async () => {
    const res = await api(`/api/v1/reports/${id}/export`, { method: "POST", body: JSON.stringify({ format }) });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scamlens-report-${String(id).slice(0, 8)}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice({ tone: "ok", text: `${format.toUpperCase()} exported.` });
  });
  const copy = () => run("copy", async () => {
    await navigator.clipboard.writeText(reportSummaryText(report));
    setNotice({ tone: "ok", text: "Report summary copied to clipboard." });
  });
  const save = () => run("save", async () => {
    const res = await api(`/api/v1/reports/${id}`, { method: "PATCH", body: JSON.stringify({ saved: true }) });
    const j = await res.json();
    setMeta({ saved: j.data.saved, expiresAt: j.data.expiresAt, shared: j.data.shared });
    setNotice({ tone: "ok", text: "Saved to your account history." });
  });
  const share = () => run("share", async () => {
    const res = await api(`/api/v1/reports/${id}/share`, { method: "POST", body: "{}" });
    const j = await res.json();
    setShareUrl(j.data.url);
    setMeta((m) => (m ? { ...m, shared: { active: true, expiresAt: j.data.expiresAt } } : m));
    setNotice({ tone: "ok", text: "Private link created. Anyone with this link can view this report until it expires or you revoke it." });
  });
  const revoke = () => run("revoke", async () => {
    await api(`/api/v1/reports/${id}/share`, { method: "DELETE" });
    setShareUrl(null);
    setMeta((m) => (m ? { ...m, shared: { active: false, expiresAt: null } } : m));
    setNotice({ tone: "ok", text: "All share links for this report were revoked." });
  });
  const del = () => run("delete", async () => {
    if (!confirm("Delete this report permanently?")) return;
    await api(`/api/v1/scans/${id}`, { method: "DELETE" });
    window.location.href = signedIn ? "/app/history" : "/app";
  });

  const sevCounts = report.findings.reduce<Record<string, number>>((m, f) => ((m[f.severity] = (m[f.severity] ?? 0) + 1), m), {});

  return (
    <div className="space-y-8" data-testid="report">
      {/* A. Overview */}
      <Section id="overview" kicker="A · Overview" title="Overall assessment">
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <Card className="print-card flex flex-col items-center justify-center p-4"><RiskGauge verdict={report.verdict} label={report.verdictLabel} score={report.scores.severity} /></Card>
          <Card className="print-card space-y-4 p-4 sm:p-5">
            <p className="text-base" role="status" aria-live="polite">{report.summary}</p>
            <KV rows={[["Subject", report.subject], ["Analysis type", report.type], ["Analyzed", format(new Date(report.createdAt), "yyyy-MM-dd HH:mm:ss")], ["Findings", Object.entries(sevCounts).map(([k, v]) => `${v} ${k}`).join(", ") || "none"]]} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-line p-3"><p className="text-[11px] uppercase tracking-wide text-muted">Evidence confidence</p><p className="text-lg font-semibold capitalize">{report.scores.confidence}</p></div>
              <div className="rounded-md border border-line p-3"><Meter value={report.scores.coveragePct} label="Scanner coverage" /></div>
              <div className="rounded-md border border-line p-3"><p className="text-[11px] uppercase tracking-wide text-muted">Data freshness</p><p className="text-xs">{report.scores.freshness.label}</p></div>
            </div>
            <p className="text-xs text-muted"><b className="text-fg">Why this confidence?</b> {report.scores.confidenceReason}</p>
            {report.localOnly && <p className="flex gap-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-xs"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" aria-hidden />Based on local analysis only – no external threat-intelligence source contributed to this result.</p>}
          </Card>
        </div>
        <h3 className="mb-2 mt-5 text-sm font-semibold">Sources consulted</h3>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Data sources and their status</caption>
            <thead className="bg-panel text-xs uppercase tracking-wide text-muted"><tr><th className="p-2.5">Source</th><th className="p-2.5">Status</th><th className="p-2.5">Detail</th></tr></thead>
            <tbody>{report.sources.map((s) => <tr key={s.id} className="border-t border-line align-top"><td className="p-2.5 font-medium">{s.name}<div className="text-[11px] font-normal text-muted">{s.kind === "local" ? "local" : "external"}</div></td><td className={`p-2.5 font-medium ${SRC_TONE[s.status]}`}>{SRC_LABEL[s.status]}{s.result ? ` · ${s.result === "match" ? "match" : "no match"}` : ""}</td><td className="p-2.5 text-muted">{s.detail}{s.attribution && s.status === "ok" && s.kind === "external" ? <div className="mt-1 text-[11px]">{s.attribution}</div> : null}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      {/* B. Findings */}
      <Section id="findings" kicker="B · Findings" title={`Findings (${report.findings.length})`}>
        {report.findings.length === 0 ? <Card className="p-4 text-sm text-muted">The checks that ran produced no findings. That does not prove safety – see limitations below.</Card> : <div className="space-y-3">{report.findings.map((f) => <FindingCard key={f.id} f={f} />)}</div>}
      </Section>

      {/* C. Technical */}
      <Section id="technical" kicker="C · Technical information" title="Technical details"><Technical r={report} /></Section>

      {/* D. Explanation */}
      <Section id="explanation" kicker="D · Risk explanation" title="How ScamLens reached this assessment">
        <Card className="space-y-4 p-4 sm:p-5">
          <p className="text-sm text-muted">{report.explanation.method}</p>
          {report.explanation.contributions.length > 0 ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><caption className="sr-only">Contribution of each indicator</caption><thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-1.5 pr-3">Indicator</th><th className="pr-3">Severity</th><th className="pr-3">Confidence</th><th className="text-right">Weight</th></tr></thead><tbody>{report.explanation.contributions.map((c) => <tr key={c.findingId} className="border-t border-line"><td className="py-1.5 pr-3">{c.title}</td><td className="pr-3"><SeverityChip severity={c.severity} /></td><td className="pr-3 capitalize text-muted">{c.confidence}</td><td className="mono text-right">{c.points}</td></tr>)}</tbody></table></div>
          ) : <p className="text-sm text-muted">No indicator added to the risk value.</p>}
          {report.explanation.disagreement && <p className="flex gap-2 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm"><ShieldAlert size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />{report.explanation.disagreement}</p>}
          <div><h3 className="mb-1 text-sm font-semibold">Analysis limitations</h3><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{report.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></div>
        </Card>
      </Section>

      {/* E. Recommendations */}
      <Section id="actions" kicker="E · Recommended actions" title="What to do next">
        <Card className="p-4 sm:p-5"><ul className="space-y-2">{report.recommendations.map((r, i) => <li key={i} className="flex gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />{r}</li>)}</ul></Card>
      </Section>

      {/* F. Report actions */}
      <section aria-labelledby="report-actions" className="no-print">
        <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent">F · Report actions</p>
        <h2 id="report-actions" className="mb-3 text-lg font-semibold">Export &amp; share</h2>
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {!readOnly && id && <>
              <button className={btn.secondary} onClick={() => download("pdf")} disabled={busy !== null}><Download size={16} aria-hidden />{busy === "pdf" ? "Exporting…" : "Export PDF"}</button>
              <button className={btn.secondary} onClick={() => download("json")} disabled={busy !== null}><FileJson size={16} aria-hidden />Export JSON</button>
            </>}
            <button className={btn.secondary} onClick={copy}><Clipboard size={16} aria-hidden />Copy summary</button>
            <button className={btn.secondary} onClick={() => window.print()}><Printer size={16} aria-hidden />Print</button>
            {!readOnly && id && (signedIn ? (
              <>
                {!meta?.saved && <button className={btn.primary} onClick={save} disabled={busy !== null}><Save size={16} aria-hidden />Save to history</button>}
                {meta?.saved && <span className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-ok/40 px-3 text-sm text-ok"><Check size={16} aria-hidden />Saved to history</span>}
                {!meta?.shared.active ? <button className={btn.secondary} onClick={share} disabled={busy !== null}><Link2 size={16} aria-hidden />Create private share link</button> : <button className={btn.danger} onClick={revoke} disabled={busy !== null}><Link2 size={16} aria-hidden />Revoke share link</button>}
                <button className={btn.danger} onClick={del} disabled={busy !== null}><Trash2 size={16} aria-hidden />Delete</button>
              </>
            ) : (
              <Link className={btn.primary} href={`/login?next=${encodeURIComponent(`/app/reports/${id}`)}&claim=${id}`}><Save size={16} aria-hidden />Sign in to save &amp; share</Link>
            ))}
          </div>
          {!readOnly && meta && !meta.saved && <p className="text-xs text-muted">This report is temporary{meta.expiresAt ? ` and will be deleted automatically on ${format(new Date(meta.expiresAt), "yyyy-MM-dd HH:mm")}` : ""}. Guests keep reports for 24 hours.</p>}
          {meta?.shared.active && <p className="text-xs text-muted">A private share link is active until {meta.shared.expiresAt ? format(new Date(meta.shared.expiresAt), "yyyy-MM-dd HH:mm") : "revoked"}. For security the link is only shown once, when created.</p>}
          {shareUrl && <div className="rounded-md border border-line bg-panel p-3"><p className="text-xs text-muted">Copy this private link now:</p><input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className="mono mt-1 w-full rounded border border-line bg-surface px-2 py-2 text-xs" /></div>}
          <div aria-live="polite" role="status">{notice && <p className={`text-sm ${notice.tone === "ok" ? "text-ok" : "text-danger"}`}>{notice.text}</p>}</div>
        </Card>
      </section>
    </div>
  );
}
