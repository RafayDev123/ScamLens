import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/app/SettingsPanel";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function Settings() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app/settings");
  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
      <p className="mt-2 text-sm text-muted">Privacy controls, retention, API keys and account deletion.</p>
      <div className="mt-6"><SettingsPanel email={user.email} name={user.displayName} /></div>
    </div>
  );
}
