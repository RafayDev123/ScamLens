import type { Metadata } from "next";
import { ReportView } from "@/components/report/ReportView";
import { getSharedReport } from "@/lib/services/store";

export const metadata: Metadata = { title: "Shared report", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function Shared({ params }: { params: Promise<{ token: string }> }) {
  const report = await getSharedReport((await params).token);
  if (!report) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">This link is no longer available</h1>
        <p className="mt-2 text-muted">The share link was revoked, has expired or never existed.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="mb-6 rounded-md border border-line bg-panel p-3 text-sm text-muted">You are viewing a private report shared by a ScamLens user. It is read-only and the link may be revoked at any time.</p>
      <ReportView report={report} signedIn={false} readOnly />
    </div>
  );
}
