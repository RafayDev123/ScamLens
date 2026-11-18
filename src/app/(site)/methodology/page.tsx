import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: "Methodology – How ScamLens Scores and Explains Risk",
  description: "How ScamLens combines heuristics and threat intelligence: severity weights, confidence, scanner coverage, data freshness and why it never says a link is safe.",
  alternates: { canonical: "/methodology" },
};

export default function Methodology() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Methodology", path: "/methodology" }])} />
      <p className="mono text-xs uppercase tracking-wider text-accent">Methodology</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">How ScamLens reaches an assessment</h1>
      <p className="mt-3 text-sm text-muted">By the ScamLens Editorial Team · Updated 2026-11-17</p>
      <p className="mt-6 rounded-lg border-l-4 border-accent bg-surface p-4 font-medium">ScamLens combines local pattern analysis with public threat-intelligence data. It reports four separate measurements – risk severity, evidence confidence, scanner coverage and data freshness – and never says something is safe.</p>
      <div className="prose-sl mt-6">
        <h2>The four measurements</h2>
        <table><thead><tr><th>Measurement</th><th>What it answers</th><th>How it is derived</th></tr></thead><tbody>
          <tr><td>Risk severity (0–100)</td><td>How serious are the warning signs found?</td><td>Noisy-OR of finding weights × confidence factors.</td></tr>
          <tr><td>Evidence confidence</td><td>How reliable is the evidence?</td><td>Corroboration between indicators/sources and indicator quality; capped when coverage is low.</td></tr>
          <tr><td>Scanner coverage</td><td>How many applicable sources returned data?</td><td>Responding sources ÷ applicable sources.</td></tr>
          <tr><td>Data freshness</td><td>How current is the data?</td><td>Timestamp of each source; live queries are made at scan time.</td></tr>
        </tbody></table>
        <h2>Severity calculation</h2>
        <p>Each finding has a severity weight (info 0, low 0.10, medium 0.28, high 0.55, critical 0.90) and a confidence factor (low 0.55, medium 0.80, high 1.00). Findings are treated as independent evidence: <code>risk = 1 − Π(1 − weight × confidence)</code>, scaled to 0–100. Every indicator&apos;s contribution is shown in the report.</p>
        <h2>Assessment levels</h2>
        <ul>
          <li><b>Likely Malicious</b> – only when an external threat-intelligence provider confirms a listing.</li>
          <li><b>High Risk</b> – risk ≥ 60 from strong heuristics.</li>
          <li><b>Suspicious</b> – risk ≥ 35.</li>
          <li><b>Caution</b> – weaker or isolated warning signs.</li>
          <li><b>No Known Threat Detected</b> – checks ran and found nothing. Not a guarantee.</li>
          <li><b>Inconclusive</b> – too little data (for example, no reputation provider was reachable).</li>
        </ul>
        <h2>Source disagreement</h2>
        <p>If providers disagree, the report says which source matched and which did not. A listing in one source is still treated as a real warning.</p>
        <h2>What ScamLens does not do</h2>
        <ul><li>It does not render or download page content.</li><li>It does not treat HTTPS, domain age or missing registration data as proof of anything.</li><li>It does not send message text to third parties.</li><li>It does not claim brand affiliation based on similarity.</li></ul>
        <h2>Data sources</h2>
        <p>Optional threat intelligence: Google Web Risk (commercial) and URLhaus by abuse.ch. Registration data: public RDAP servers. DNS: the server resolver plus a DNSSEC flag from Cloudflare DNS-over-HTTPS. TLS: one handshake directly with the target. Providers that are not configured are shown as &ldquo;configuration required&rdquo;.</p>
      </div>
    </div>
  );
}
