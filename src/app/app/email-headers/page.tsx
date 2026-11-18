import type { Metadata } from "next";
import { ToolShell } from "@/components/app/ToolShell";
import { EmailTool } from "@/components/tools/EmailTool";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Email Header Analyzer" };

export default async function Page() {
  const user = await getSessionUser();
  return (
    <ToolShell module="Additional tool" title="Email Header Analyzer" intro="Paste raw email headers to understand SPF, DKIM, DMARC and sender mismatches.">
      <EmailTool signedIn={Boolean(user)} />
    </ToolShell>
  );
}
