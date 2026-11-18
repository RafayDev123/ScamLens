import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/ReportView";
import { GUEST_COOKIE, getSessionUser } from "@/lib/auth";
import { getReport, type Actor } from "@/lib/services/store";

export const metadata: Metadata = { title: "Report", robots: { index: false, follow: false } };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, jar] = await Promise.all([params, getSessionUser(), cookies()]);
  const guest = jar.get(GUEST_COOKIE)?.value;
  const actor: Actor | null = user ? { kind: "user", userId: user.id, role: user.role } : guest && /^[a-f0-9]{32}$/.test(guest) ? { kind: "guest", guestId: guest } : null;
  const found = actor ? await getReport(id, actor) : null;
  if (!found) notFound();
  return (
    <div>
      <Link href={user ? "/app/reports" : "/app"} className="text-sm text-muted hover:text-accent">← Back</Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold sm:text-3xl">Analysis report</h1>
      <ReportView report={found.report} reportId={id} meta={{ saved: found.saved, expiresAt: found.expiresAt, shared: found.shared }} signedIn={Boolean(user)} />
    </div>
  );
}
