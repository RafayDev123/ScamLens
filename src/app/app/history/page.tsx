import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HistoryTable } from "@/components/app/HistoryTable";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Scan History" };

export default async function History() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app/history");
  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">Scan history</h1>
      <p className="mt-2 text-sm text-muted">Search, filter, open, delete or export your records. Retention is controlled in Settings (see <a className="text-accent underline" href="/privacy">privacy rules</a>).</p>
      <div className="mt-6"><HistoryTable /></div>
    </div>
  );
}
