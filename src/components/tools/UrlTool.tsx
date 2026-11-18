"use client";

import { FileSpreadsheet, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { btn, input, VerdictBadge } from "@/components/ui";
import type { Verdict } from "@/lib/types";
import { Field, ProviderConsent, ScanResult, useConsent, useScan } from "./kit";

const STEPS = ["Validating & normalizing URL", "Inspecting structure and lookalikes", "Querying configured reputation sources", "Collecting redirect data (if requested)", "Building explainable report"];

interface BulkRow { input: string; reportId?: string; verdict?: Verdict; verdictLabel?: string; riskSeverity?: number; error?: { code: string; message: string } }

function parseCsv(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const cell of line.split(",")) {
      const v = cell.trim().replace(/^"|"$/g, "");
      if (/^(url|link|website)s?$/i.test(v)) continue;
      if (v && /^(https?:\/\/)?[^\s/]+\.[^\s/]+/i.test(v)) {
        out.push(v);
        break;
      }
    }
  }
  return out;
}

export function UrlTool({ signedIn, initialUrl = "", compact = false }: { signedIn: boolean; initialUrl?: string; compact?: boolean }) {
  const [url, setUrl] = useState(initialUrl);
  const [consent, setConsent] = useConsent();
  const [redirects, setRedirects] = useState(false);
  const scan = useScan("/api/v1/scans/url");
  const [bulk, setBulk] = useState<{ loading: boolean; error: string | null; rows: BulkRow[] }>({ loading: false, error: null, rows: [] });
  const fileRef = useRef<HTMLInputElement>(null);
  const didAuto = useRef(false);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!url.trim()) return;
    setBulk({ loading: false, error: null, rows: [] });
    void scan.run({ url: url.trim(), shareWithProviders: consent, inspectRedirects: redirects });
  }
  useEffect(() => {
    // Links from the Message Analyzer / QR checker pre-fill the field but never auto-run: the user decides.
    didAuto.current = true;
  }, []);

  async function onCsv(file: File | undefined) {
    if (!file) return;
    scan.reset();
    if (file.size > 200_000) return setBulk({ loading: false, error: "CSV files are limited to 200 KB.", rows: [] });
    const urls = parseCsv(await file.text()).slice(0, 25);
    if (!urls.length) return setBulk({ loading: false, error: "No URLs found. Put one URL per line (or in the first column).", rows: [] });
    setBulk({ loading: true, error: null, rows: [] });
    try {
      const res = await fetch("/api/v1/scans/url/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls, shareWithProviders: consent, inspectRedirects: redirects }) });
      const j = await res.json();
      if (!res.ok) return setBulk({ loading: false, error: j?.error?.message ?? "Bulk analysis failed.", rows: [] });
      setBulk({ loading: false, error: null, rows: j.data.results });
    } catch {
      setBulk({ loading: false, error: "Network error during bulk analysis.", rows: [] });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-3" aria-label="URL scanner">
        <Field id="url-input" label="Link to analyze" hint={compact ? undefined : "Paste the full link exactly as received. Do not submit private, logged-in or password-reset links – they can contain access tokens."}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="url-input" name="url" type="text" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2048} required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/verify-account" className={`${input} mono`} />
            <button type="submit" className={`${btn.primary} sm:w-40`} disabled={scan.loading || !url.trim()}><Search size={16} aria-hidden />{scan.loading ? "Analyzing…" : "Analyze URL"}</button>
          </div>
        </Field>
        <div className="grid gap-2 lg:grid-cols-2">
          <ProviderConsent checked={consent} onChange={setConsent} what="Sends the link to the reputation providers you have configured (e.g. Google Web Risk, URLhaus)." />
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-panel p-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={redirects} onChange={(e) => setRedirects(e.target.checked)} />
            <span><b>Expand redirects.</b> <span className="text-muted">Our restricted fetcher requests headers only (public addresses, ≤6 hops, no page download) to reveal where the link ends. The page is never opened in your browser.</span></span>
          </label>
        </div>
        {!compact && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <input ref={fileRef} id="csv" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onCsv(e.target.files?.[0])} disabled={!signedIn} />
            <label htmlFor="csv" className={`${btn.secondary} ${signedIn ? "cursor-pointer" : "pointer-events-none opacity-50"}`}><FileSpreadsheet size={16} aria-hidden />Bulk analysis from CSV</label>
            <span className="text-xs text-muted">{signedIn ? "Up to 25 URLs, one per line. Limited to 5 bulk runs per hour." : <><Link href="/login?next=/app/url-scanner" className="text-accent underline">Sign in</Link> to use bulk CSV analysis (abuse protection).</>}</span>
          </div>
        )}
      </form>

      {bulk.loading && <p className="mt-6 text-sm" role="status">Analyzing CSV… this can take a minute.</p>}
      {bulk.error && <p role="alert" className="mt-4 text-sm text-danger">{bulk.error}</p>}
      {bulk.rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Bulk analysis results</caption>
            <thead className="bg-panel text-xs uppercase tracking-wide text-muted"><tr><th className="p-2.5">URL (redacted)</th><th className="p-2.5">Assessment</th><th className="p-2.5">Risk</th><th className="p-2.5"><span className="sr-only">Report</span></th></tr></thead>
            <tbody>{bulk.rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="mono max-w-[260px] truncate p-2.5 text-[13px]" title={r.input}>{r.input}</td>
                <td className="p-2.5">{r.verdict ? <VerdictBadge verdict={r.verdict} label={r.verdictLabel ?? r.verdict} /> : <span className="text-danger">{r.error?.message}</span>}</td>
                <td className="mono p-2.5">{r.riskSeverity ?? "–"}</td>
                <td className="p-2.5 text-right">{r.reportId && <Link className="text-accent underline" href={`/app/reports/${r.reportId}`}>Open report</Link>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <ScanResult s={scan} signedIn={signedIn} steps={STEPS} />
    </div>
  );
}
