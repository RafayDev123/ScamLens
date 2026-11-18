import type { Metadata } from "next";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { BarDistribution } from "@/components/app/Charts";
import { Card, Eyebrow } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { providerOverview } from "@/lib/providers";
import { adminStats } from "@/lib/services/store";

export const metadata: Metadata = { title: "Admin" };

export default async function Admin() {
  const user = await getSessionUser();
  // Server-side role check: hiding the nav item is not authorization.
  if (!user || user.role !== "admin") notFound();
  const s = await adminStats();
  const last = new Map(s.providers.map((p) => [String(p.provider_id), p]));
  const stat = (label: string, v: number | string) => <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">{label}</p><p className="mono mt-1 text-2xl font-bold">{v}</p></Card>;
  return (
    <div className="space-y-8">
      <div><Eyebrow>Administration</Eyebrow><h1 className="mt-1 text-2xl font-bold sm:text-3xl">System overview</h1><p className="mt-2 text-sm text-muted">Aggregates only. Submitted messages and full URLs are never shown here.</p></div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Totals">{stat("Registered users", s.users)}{stat("Total scans", s.scans)}{stat("Requests (24h)", s.usage.total ?? 0)}{stat("API-key calls (24h)", s.usage.api_calls ?? 0)}{stat("Server errors 5xx (24h)", s.usage.errors5xx ?? 0)}{stat("Rate-limit events (24h)", s.usage.limited ?? 0)}{stat("Queue", "n/a – inline")}{stat("DB", "connected")}</section>
      <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Scan type distribution</h2><BarDistribution label="Scan type distribution" data={s.byType.map((t) => ({ name: t.type, value: t.n }))} /></Card>
      <section aria-labelledby="prov"><h2 id="prov" className="mb-2 font-semibold">Provider availability</h2>
        <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-panel text-xs uppercase text-muted"><tr><th className="p-2.5">Provider</th><th className="p-2.5">Configured</th><th className="p-2.5">Last result</th><th className="p-2.5">OK / fail</th></tr></thead><tbody>{providerOverview().map((p) => { const r = last.get(p.id); return <tr key={p.id} className="border-t border-line"><td className="p-2.5">{p.name}</td><td className="p-2.5">{p.configured ? "yes" : <span className="text-warn">configuration required</span>}</td><td className="p-2.5 text-muted">{r ? `${r.last_status} – ${r.last_detail ?? ""}` : "no queries yet"}</td><td className="mono p-2.5">{r ? `${r.success_count} / ${r.failure_count}` : "–"}</td></tr>; })}</tbody></table></div></section>
      <section aria-labelledby="err"><h2 id="err" className="mb-2 font-semibold">Error codes (24h)</h2>{s.errors.length ? <ul className="grid gap-2 sm:grid-cols-2">{s.errors.map((e) => <li key={e.error_code} className="flex justify-between rounded-md border border-line bg-surface p-2.5 text-sm"><span className="mono">{e.error_code}</span><b>{e.n}</b></li>)}</ul> : <p className="text-sm text-muted">No errors recorded.</p>}</section>
      <section aria-labelledby="aud"><h2 id="aud" className="mb-2 font-semibold">Security audit log (latest 25)</h2><div className="overflow-x-auto rounded-lg border border-line"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-panel text-xs uppercase text-muted"><tr><th className="p-2.5">Time</th><th className="p-2.5">Action</th><th className="p-2.5">User</th><th className="p-2.5">IP hash</th></tr></thead><tbody>{s.audit.map((a, i) => <tr key={i} className="border-t border-line"><td className="whitespace-nowrap p-2.5 text-xs text-muted">{format(new Date(String(a.created_at)), "yyyy-MM-dd HH:mm:ss")}</td><td className="mono p-2.5">{String(a.action)}</td><td className="p-2.5">{a.email ? String(a.email) : "—"}</td><td className="mono p-2.5 text-xs">{a.ip_hash ? String(a.ip_hash) : "—"}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
