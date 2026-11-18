"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { btn, input } from "@/components/ui";
import { Field, ScanResult, useScan } from "./kit";

const STEPS = ["Unfolding and parsing headers", "Reading SPF / DKIM / DMARC results", "Comparing From, Reply-To, Return-Path, Message-ID", "Walking the Received chain", "Building explainable report"];
const DEMO = `Received: from mail.demo-sender.example (mail.demo-sender.example [203.0.113.9]) by mx.receiver.example with ESMTPS; Tue, 1 Oct 2024 10:00:00 +0000
Authentication-Results: mx.receiver.example; spf=fail smtp.mailfrom=demo-sender.example; dkim=none; dmarc=fail header.from=bank-alerts.example
From: "Demo Bank Support" <alerts@bank-alerts.example>
Reply-To: <collect@mailbox.example>
Return-Path: <bounce@demo-sender.example>
Message-ID: <12345@demo-sender.example>
Subject: Demonstration headers (fictional)`;

export function EmailTool({ signedIn }: { signedIn: boolean }) {
  const [h, setH] = useState("");
  const scan = useScan("/api/v1/scans/email-header");
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); void scan.run({ headers: h }); }} className="space-y-3" aria-label="Email header analyzer">
        <Field id="hdr" label="Raw email headers" hint="In Gmail: ⋮ → Show original. In Outlook: File → Properties → Internet headers. ScamLens never needs mailbox access or passwords.">
          <textarea id="hdr" required rows={10} maxLength={30000} value={h} onChange={(e) => setH(e.target.value)} placeholder={"Received: from …\nAuthentication-Results: …\nFrom: …"} className={`${input} mono resize-y text-xs`} spellCheck={false} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btn.primary} disabled={scan.loading || h.trim().length < 20}><Mail size={16} aria-hidden />{scan.loading ? "Analyzing…" : "Analyze headers"}</button>
          <button type="button" className={btn.ghost} onClick={() => setH(DEMO)}>Load demonstration headers</button>
        </div>
      </form>
      <ScanResult s={scan} signedIn={signedIn} steps={STEPS} />
    </div>
  );
}
