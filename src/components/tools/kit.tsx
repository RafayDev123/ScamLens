"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ReportView, type ReportMeta } from "@/components/report/ReportView";
import type { Report } from "@/lib/types";

export interface ScanState {
  loading: boolean;
  error: string | null;
  report: Report | null;
  meta: ReportMeta | undefined;
}

/** Posts to a /api/v1/scans/* endpoint and loads the persisted report metadata. */
export function useScan(endpoint: string) {
  const [state, setState] = useState<ScanState>({ loading: false, error: null, report: null, meta: undefined });
  const abort = useRef<AbortController | null>(null);
  const run = useCallback(
    async (body: unknown) => {
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      setState({ loading: true, error: null, report: null, meta: undefined });
      try {
        const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = json?.error?.message ?? `The request failed (${res.status}).`;
          setState({ loading: false, error: res.status === 429 ? `${msg} ${res.headers.get("retry-after") ? `Try again in ${res.headers.get("retry-after")}s.` : ""}` : msg, report: null, meta: undefined });
          return;
        }
        const report = json.data.report as Report;
        let meta: ReportMeta | undefined;
        try {
          const m = await fetch(`/api/v1/reports/${report.id}`, { signal: ac.signal });
          if (m.ok) {
            const mj = await m.json();
            meta = { saved: mj.data.saved, expiresAt: mj.data.expiresAt, shared: mj.data.shared };
          }
        } catch {
          /* metadata is optional */
        }
        setState({ loading: false, error: null, report, meta });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ loading: false, error: "Network error – the analysis service could not be reached.", report: null, meta: undefined });
      }
    },
    [endpoint],
  );
  const reset = useCallback(() => setState({ loading: false, error: null, report: null, meta: undefined }), []);
  useEffect(() => () => abort.current?.abort(), []);
  return { ...state, run, reset };
}

export function ScanProgress({ steps }: { steps: string[] }) {
  return (
    <div className="scanline rounded-lg border border-line bg-surface p-4" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="animate-spin text-accent" size={16} aria-hidden />Analysis in progress…</p>
      <ul className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">{steps.map((s) => <li key={s} className="mono">› {s}</li>)}</ul>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/50 bg-danger/10 p-3 text-sm">
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

/** Opt-in disclosure before anything is sent to third-party reputation providers. Choice is remembered locally. */
export function ProviderConsent({ checked, onChange, what }: { checked: boolean; onChange: (v: boolean) => void; what: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-panel p-3 text-sm">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={checked} onChange={(e) => { onChange(e.target.checked); try { localStorage.setItem("sl_consent_providers", e.target.checked ? "1" : "0"); } catch { /* ignore */ } }} />
      <span><b>Check external reputation databases.</b> <span className="text-muted">{what} Providers only receive the address without credentials or fragment; they are listed in the report. If unticked, only local analysis runs.</span></span>
    </label>
  );
}

export function useConsent(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time read of the remembered consent choice
      setV(localStorage.getItem("sl_consent_providers") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  return [v, setV];
}

export function ScanResult({ s, signedIn, steps }: { s: ScanState; signedIn: boolean; steps: string[] }) {
  return (
    <div className="mt-6 space-y-4" aria-live="polite">
      {s.loading && <ScanProgress steps={steps} />}
      {s.error && <ErrorBox message={s.error} />}
      {s.report && <ReportView report={s.report} reportId={s.report.id} meta={s.meta} signedIn={signedIn} />}
    </div>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
