import type { Metadata } from "next";
import { ToolShell } from "@/components/app/ToolShell";
import { MessageTool } from "@/components/tools/MessageTool";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Message Analyzer" };

export default async function Page() {
  const user = await getSessionUser();
  return (
    <ToolShell module="Module 02" title="Message Analyzer" intro="Paste a suspicious WhatsApp, SMS or email message. Analysis runs locally in English, Urdu and Roman Urdu.">
      <MessageTool signedIn={Boolean(user)} />
    </ToolShell>
  );
}
