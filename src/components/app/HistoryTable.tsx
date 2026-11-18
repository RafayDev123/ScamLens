"use client";

import { format } from "date-fns";
import { Download, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { btn, EmptyState, input, VerdictBadge } from "@/components/ui";
import { VERDICT_LABEL, type Verdict } from "@/lib/types";

interface Row { id: string; type: string; subject: string; verdict: Verdict; riskScore: number; findingCount: number; saved: boolean; createdAt: string }
const TYPES = [["", "All types"], ["url", "URL"], ["message", "Message"], ["qr", "QR"], ["domain", "Domain"], ["email-header", "Email header"]];

export function HistoryTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (type) p.set("type", type);
    if (query) p.set("q", query);
    try {
      const res = await fetch(`/api/v1/scans?${p}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message ?? "Failed to load history");
      setRows(j.data.items);
      setPages(j.data.pagination.totalPages);
      setTotal(j.data.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [page, type, query]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on filter/page change
  useEffect(() => { void load(); }, [load]);

  async function del(id: string) {
    if (!confirm("Delete this scan record permanently?")) return;
    const res = await fetch(`/api/v1/scans/${id}`, { method: "DELETE" });
    if (res.ok) void load();
    else setError("Could not delete the record.");
  }

  return (
    <div>
      <form className="flex flex-col gap-2 sm:flex-row" role="search" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q); }}>
        <label className="sr-only" htmlFor="hq">Search history</label>
        <input id="hq" className={input} placeholder="Search subjects or assessments…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="ht">Filter by type</label>
        <select id="ht" className={`${input} sm:w-44`} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className={btn.secondary}><Search size={16} aria-hidden />Search</button>
        <a className={btn.secondary} href="/api/account/export" download><Download size={16} aria-hidden />Export all</a>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4" aria-busy={loading}>
        {loading ? <p className="text-sm text-muted" role="status">Loading…</p> : rows.length === 0 ? (
          <EmptyState title={query || type ? "No matching records" : "No scans yet"} body={query || type ? "Try a different search or filter." : "Your scans are saved here when history is enabled in Settings."} action={<Link href="/app/url-scanner" className={btn.primary}>Start a scan</Link>} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Scan history, {total} records</caption>
              <thead className="bg-panel text-xs uppercase tracking-wide text-muted"><tr><th className="p-2.5">When</th><th className="p-2.5">Type</th><th className="p-2.5">Subject (redacted)</th><th className="p-2.5">Assessment</th><th className="p-2.5 text-right">Actions</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap p-2.5 text-xs text-muted">{format(new Date(r.createdAt), "yyyy-MM-dd HH:mm")}</td>
                  <td className="p-2.5 capitalize">{r.type.replace("-", " ")}</td>
                  <td className="mono max-w-[260px] truncate p-2.5 text-[13px]" title={r.subject}>{r.subject}</td>
                  <td className="p-2.5"><VerdictBadge verdict={r.verdict} label={VERDICT_LABEL[r.verdict] ?? r.verdict} /></td>
                  <td className="whitespace-nowrap p-2.5 text-right"><Link className="text-accent underline" href={`/app/reports/${r.id}`}>Open</Link><button className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded text-danger hover:bg-danger/10" onClick={() => void del(r.id)} aria-label={`Delete scan of ${r.subject.slice(0, 40)}`}><Trash2 size={16} aria-hidden /></button></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
      {pages > 1 && <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination"><button className={btn.secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-muted">Page {page} of {pages}</span><button className={btn.secondary} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></nav>}
    </div>
  );
}
