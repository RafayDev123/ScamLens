import type { Metadata } from "next";
import { format } from "date-fns";
import { Globe, Link2, Mail, MessageSquareWarning, QrCode } from "lucide-react";
import Link from "next/link";
import { BarDistribution } from "@/components/app/Charts";
import { btn, Card, EmptyState, Eyebrow, VerdictBadge, VERDICT_VAR } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { dashboardStats } from "@/lib/services/store";
import { VERDICT_LABEL, type Verdict } from "@/lib/types";

export const metadata: Metadata = { title: "Overview" };

const TOOLS = [
  { href: "/app/url-scanner", label: "URL Scanner", icon: Link2, body: "Check a link for phishing and malware signals." },
  { href: "/app/message-analyzer", label: "Message Analyzer", icon: MessageSquareWarning, body: "Find scam wording in SMS, WhatsApp and email." },
  { href: "/app/qr-checker", label: "QR Checker", icon: QrCode, body: "Decode a QR code and inspect its destination." },
  { href: "/app/domain-intelligence", label: "Domain Intelligence", icon: Globe, body: "RDAP, DNS, TLS and lookalike signals." },
  { href: "/app/email-headers", label: "Email Headers", icon: Mail, body: "SPF, DKIM, DMARC and sender mismatches." },
];
const TYPE_LABEL: Record<string, string> = { url: "URL", message: "Message", qr: "QR", domain: "Domain", "email-header": "Email" };

export default async function Overview() {
  const user = await getSessionUser();
  const stats = user ? await dashboardStats(user.id) : null;
  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>Overview</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{user ? `Welcome${user.displayName ? `, ${user.displayName}` : ""}` : "Check before you click"}</h1>
        <p className="mt-2 text-sm text-muted">{user ? "Everything shown here comes from your own saved scans." : "Guest mode: run limited scans without an account. Reports are kept for 24 hours."}</p>
      </div>
      <section aria-label="Start a scan" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => <Link key={t.href} href={t.href} className="group rounded-lg border border-line bg-surface p-4 transition hover:border-accent"><t.icon size={20} className="text-azure group-hover:text-accent" aria-hidden /><h2 className="mt-2 font-semibold">{t.label}</h2><p className="mt-1 text-sm text-muted">{t.body}</p></Link>)}
      </section>
      {user && stats && (
        stats.total === 0 ? (
          <EmptyState title="No scans yet" body="Your dashboard fills with real data as soon as you run your first scan. Nothing here is pre-filled." action={<Link href="/app/url-scanner" className={btn.primary}>Run your first scan</Link>} />
        ) : (
          <>
            <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Total scans</p><p className="mono mt-1 text-3xl font-bold">{stats.total}</p></Card>
              {["url", "message", "qr"].map((k) => <Card key={k} className="p-4"><p className="text-xs uppercase tracking-wide text-muted">{TYPE_LABEL[k]} scans</p><p className="mono mt-1 text-3xl font-bold">{stats.byType.find((t) => t.type === k)?.n ?? 0}</p></Card>)}
              <Card className="col-span-2 p-4 lg:col-span-4"><p className="text-xs uppercase tracking-wide text-muted">Suspicious findings (Suspicious, High Risk or Likely Malicious assessments)</p><p className="mono mt-1 text-3xl font-bold">{stats.flagged}</p></Card>
            </section>
            <section className="grid gap-4 md:grid-cols-2" aria-label="Distributions">
              <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Scans by type</h2><BarDistribution label="Scans by type" data={stats.byType.map((t) => ({ name: TYPE_LABEL[t.type] ?? t.type, value: t.n }))} /></Card>
              <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Assessments</h2><BarDistribution label="Scans by assessment" data={stats.byVerdict.map((v) => ({ name: (VERDICT_LABEL[v.verdict as Verdict] ?? v.verdict).replace("No Known Threat Detected", "No known threat"), value: v.n, key: v.verdict }))} colors={VERDICT_VAR as Record<string, string>} /></Card>
            </section>
            <section aria-labelledby="recent-h"><div className="mb-3 flex items-center justify-between"><h2 id="recent-h" className="font-semibold">Recent scans</h2><Link href="/app/history" className="text-sm text-accent underline">View all</Link></div>
              <ul className="space-y-2">{stats.recent.map((r) => <li key={r.id}><Link href={`/app/reports/${r.id}`} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 hover:border-accent sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0"><span className="mono block truncate text-sm">{r.subject}</span><span className="text-xs text-muted">{TYPE_LABEL[r.type] ?? r.type} · {format(new Date(r.createdAt), "yyyy-MM-dd HH:mm")}</span></span><VerdictBadge verdict={r.verdict as Verdict} label={VERDICT_LABEL[r.verdict as Verdict] ?? r.verdict} /></Link></li>)}</ul>
            </section>
          </>
        )
      )}
      {!user && <Card className="p-5 text-sm"><b>Want history, saved reports and private share links?</b> <span className="text-muted">Create a free account.</span><div className="mt-3 flex gap-2"><Link href="/register" className={btn.primary}>Create account</Link><Link href="/login" className={btn.secondary}>Sign in</Link></div></Card>}
    </div>
  );
}
