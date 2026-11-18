import type { Metadata } from "next";
import { ToolShell } from "@/components/app/ToolShell";
import { DomainTool } from "@/components/tools/DomainTool";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Domain Intelligence" };

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  return (
    <ToolShell module="Module 04" title="Domain Intelligence" intro="RDAP registration, DNS, SPF/DMARC, DNSSEC flag, TLS certificate, lookalike and reputation signals – using passive queries only.">
      <DomainTool signedIn={Boolean(user)} initialDomain={sp.d?.slice(0, 300) ?? ""} />
    </ToolShell>
  );
}
