"use client";

import { Globe } from "lucide-react";
import { useState } from "react";
import { btn, input } from "@/components/ui";
import { Field, ProviderConsent, ScanResult, useConsent, useScan } from "./kit";

const STEPS = ["RDAP registration lookup", "DNS records (A, AAAA, MX, NS, TXT, CAA, SPF, DMARC)", "DNSSEC validation flag", "One TLS handshake on port 443", "Lookalike & reputation checks"];

export function DomainTool({ signedIn, initialDomain = "" }: { signedIn: boolean; initialDomain?: string }) {
  const [domain, setDomain] = useState(initialDomain);
  const [consent, setConsent] = useConsent();
  const scan = useScan("/api/v1/scans/domain");
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); void scan.run({ domain: domain.trim(), shareWithProviders: consent }); }} className="space-y-3" aria-label="Domain intelligence">
        <Field id="domain-input" label="Domain name" hint="Enter a domain such as example.com (a full URL is accepted – only the domain is used). Only passive, standards-based queries are made: no port scanning.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="domain-input" type="text" inputMode="url" autoComplete="off" spellCheck={false} maxLength={300} required value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className={`${input} mono`} />
            <button type="submit" className={`${btn.primary} sm:w-48`} disabled={scan.loading || !domain.trim()}><Globe size={16} aria-hidden />{scan.loading ? "Investigating…" : "Investigate domain"}</button>
          </div>
        </Field>
        <ProviderConsent checked={consent} onChange={setConsent} what="Sends the domain name to the reputation providers you have configured." />
      </form>
      <ScanResult s={scan} signedIn={signedIn} steps={STEPS} />
    </div>
  );
}
