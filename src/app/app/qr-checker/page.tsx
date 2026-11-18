import type { Metadata } from "next";
import { ToolShell } from "@/components/app/ToolShell";
import { QrTool } from "@/components/tools/QrTool";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "QR Code Checker" };

export default async function Page() {
  const user = await getSessionUser();
  return (
    <ToolShell module="Module 03" title="QR Code Checker" intro="Decode a QR code in your browser and inspect its destination without opening it.">
      <QrTool signedIn={Boolean(user)} />
    </ToolShell>
  );
}
