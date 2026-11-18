"use client";

import { Lock, ScanText } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { btn, input } from "@/components/ui";
import { extractUrls } from "@/lib/analysis/extract";
import { Field, ScanResult, useScan } from "./kit";

const STEPS = ["Redacting numbers, e-mail addresses and link secrets", "Detecting language (English / Urdu / Roman Urdu)", "Matching scam-pattern rules", "Assessing embedded links locally", "Building explainable report"];
const DEMO = "DEMO MESSAGE (fictional): Dear customer, your bank account will be blocked today. Verify immediately and share your OTP at http://bank-secure-verify.example.top/login";

export function MessageTool({ signedIn }: { signedIn: boolean }) {
  const [text, setText] = useState("");
  const scan = useScan("/api/v1/scans/message");
  const [submitted, setSubmitted] = useState("");
  const links = useMemo(() => extractUrls(submitted), [submitted]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(text);
    void scan.run({ message: text });
  }
  return (
    <div>
      <form onSubmit={submit} className="space-y-3" aria-label="Message analyzer">
        <Field id="msg" label="Suspicious message" hint="Works with WhatsApp, SMS, email text, job offers and more – in English, Urdu or Roman Urdu. Never paste real passwords or OTPs.">
          <textarea id="msg" required maxLength={5000} rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the message here…" className={`${input} resize-y`} dir="auto" />
          <div className="mt-1 flex justify-between text-xs text-muted"><span>{text.length}/5000</span>{text.length > 4500 && <span className="text-warn">Approaching the limit</span>}</div>
        </Field>
        <p className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-muted"><Lock size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span><b className="text-fg">Private by default.</b> Messages are analysed by ScamLens&apos; own rules on our server. They are <b>not</b> sent to any third-party or AI service. Numbers, e-mail addresses and link secrets are redacted before anything is stored.</span></p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btn.primary} disabled={scan.loading || !text.trim()}><ScanText size={16} aria-hidden />{scan.loading ? "Analyzing…" : "Analyze message"}</button>
          <button type="button" className={btn.ghost} onClick={() => setText(DEMO)}>Load demonstration message</button>
          {text && <button type="button" className={btn.ghost} onClick={() => { setText(""); scan.reset(); }}>Clear</button>}
        </div>
      </form>
      <ScanResult s={scan} signedIn={signedIn} steps={STEPS} />
      {scan.report && links.length > 0 && (
        <section className="mt-6 rounded-lg border border-line bg-surface p-4" aria-labelledby="links-h">
          <h2 id="links-h" className="text-base font-semibold">Links found in this message</h2>
          <p className="mb-3 text-xs text-muted">Analyze each link separately with reputation and redirect checks. Nothing is opened for you.</p>
          <ul className="space-y-2">{links.map((l) => (
            <li key={l} className="flex flex-col gap-2 rounded-md border border-line p-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="mono break-all text-[13px]">{l.replace(/\?.*$/, (m) => (m.length > 1 ? "?…" : ""))}</span>
              <Link className={btn.secondary} href={`/app/url-scanner?u=${encodeURIComponent(l)}`}>Analyze this link</Link>
            </li>))}</ul>
        </section>
      )}
    </div>
  );
}
