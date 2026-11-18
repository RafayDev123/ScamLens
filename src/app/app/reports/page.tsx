import type { Metadata } from "next";
import Link from "next/link";
import { VerdictBadge, EmptyState, btn } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { listScans } from "@/lib/services/store";
import { VERDICT_LABEL, type Verdict } from "@/lib/types";
import { redirect } from "next/navigation";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Reports" };

export default async function Reports() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app/reports");
  const { items, total } = await listScans({ kind: "user", userId: user.id, role: user.role }, { page: 1, pageSize: 30, savedOnly: true });
  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">Reports</h1>
      <p className="mt-2 text-sm text-muted">Saved reports are private to your account. {total} saved.</p>
      <div className="mt-6 space-y-3">
        {items.length === 0 ? <EmptyState title="No saved reports yet" body="Run a scan and your explainable report will appear here." action={<Link href="/app/url-scanner" className={btn.primary}>Start your first scan</Link>} /> : items.map((r) => (
          <Link key={r.id} href={`/app/reports/${r.id}`} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition hover:border-accent sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="mono truncate text-sm">{r.subject}</p><p className="mt-1 text-xs text-muted">{r.type} · {format(new Date(r.createdAt), "yyyy-MM-dd HH:mm")} · {r.findingCount} finding(s)</p></div>
            <VerdictBadge verdict={r.verdict as Verdict} label={VERDICT_LABEL[r.verdict as Verdict] ?? r.verdict} />
          </Link>
        ))}
      </div>
    </div>
  );
}
