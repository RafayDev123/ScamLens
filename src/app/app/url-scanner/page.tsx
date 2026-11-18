import type { Metadata } from "next";
import { ToolShell } from "@/components/app/ToolShell";
import { UrlTool } from "@/components/tools/UrlTool";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "URL Scanner" };

export default async function Page({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  return (
    <ToolShell module="Module 01" title="URL Scanner" intro="Analyze a link's structure, lookalike signals, reputation and redirects without opening it. Also handles short links and CSV bulk analysis.">
      <UrlTool signedIn={Boolean(user)} initialUrl={sp.u?.slice(0, 2048) ?? ""} />
    </ToolShell>
  );
}
