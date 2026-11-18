import type { Metadata } from "next";
import { AppNav } from "@/components/app/AppNav";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "App", template: "%s | ScamLens" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AppNav signedIn={Boolean(user)} isAdmin={user?.role === "admin"} name={user?.displayName ?? user?.email ?? null} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
