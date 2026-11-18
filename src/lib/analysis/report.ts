import {
  VERDICT_LABEL,
  type Confidence,
  type Finding,
  type Report,
  type ScanType,
  type ScoreContribution,
  type Severity,
  type SourceStatus,
  type ThreatMatch,
  type Verdict,
} from "@/lib/types";
import type { RawFinding } from "./url";

/**
 * Risk scoring method (documented in docs/ARCHITECTURE.md)
 * --------------------------------------------------------
 * Each finding has a severity weight and a confidence factor:
 *   weight:      info 0 · low 0.10 · medium 0.28 · high 0.55 · critical 0.90
 *   confidence:  low 0.55 · medium 0.80 · high 1.00
 * Findings are combined as independent evidence (noisy-OR):
 *   risk = 1 − Π (1 − weight × confidenceFactor)       → shown as 0-100 "risk severity"
 * Severity is NOT confidence, coverage or freshness – those are reported separately.
 * Only a *confirmed external threat-intelligence match* may produce "Likely Malicious".
 * Local heuristics alone can reach at most "High Risk".
 */
export const SEVERITY_WEIGHT: Record<Severity, number> = { info: 0, low: 0.1, medium: 0.28, high: 0.55, critical: 0.9 };
export const CONFIDENCE_FACTOR: Record<Confidence, number> = { low: 0.55, medium: 0.8, high: 1 };

export interface BuildInput {
  type: ScanType;
  subject: string;
  findings: RawFinding[];
  sources: SourceStatus[];
  threatMatches?: ThreatMatch[];
  technical: Record<string, unknown>;
  recommendations?: string[];
  limitations?: string[];
  embeddedUrls?: Report["embeddedUrls"];
  /**
   * Message / header analysis is local by design. When true, zero findings from the
   * local analyzer can be reported as "No Known Threat Detected" (never "safe").
   */
  localIsSufficient?: boolean;
  /** Minimal amount of input needed for a meaningful negative result. */
  enoughInput?: boolean;
  now?: Date;
}

export function computeRisk(findings: Pick<Finding, "severity" | "confidence">[]): number {
  let keep = 1;
  for (const f of findings) keep *= 1 - SEVERITY_WEIGHT[f.severity] * CONFIDENCE_FACTOR[f.confidence];
  return Math.round((1 - keep) * 100);
}

const GENERAL_ACTIONS = [
  "Never share passwords, one-time passcodes (OTPs), PINs or card details with anyone who contacts you first.",
  "Visit official websites by typing their known address yourself instead of following links.",
  "Verify the sender through an independently confirmed channel (the number on your card, the official website or app).",
];

export function buildReport(input: BuildInput): Report {
  const now = input.now ?? new Date();
  const ts = now.toISOString();
  const findings: Finding[] = input.findings.map((f, i) => ({ ...f, id: `f${i + 1}`, timestamp: ts }));
  const order: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
  findings.sort((a, b) => order[b.severity] - order[a.severity]);
  findings.forEach((f, i) => (f.id = `f${i + 1}`));

  const severity = computeRisk(findings);
  const applicable = input.sources.filter((s) => s.status !== "skipped");
  const okSources = applicable.filter((s) => s.status === "ok");
  const coveragePct = applicable.length ? Math.round((okSources.length / applicable.length) * 100) : 0;
  const externalOk = okSources.filter((s) => s.kind === "external");
  const reputationOk = okSources.filter((s) => s.result !== undefined && !s.id.includes("test-fixture"));
  const confirmed = findings.some((f) => f.confirmed);
  const maxSev = findings.reduce<Severity>((m, f) => (order[f.severity] > order[m] ? f.severity : m), "info");

  let verdict: Verdict;
  if (confirmed) verdict = "likely_malicious";
  else if (severity >= 60) verdict = "high_risk";
  else if (severity >= 35) verdict = "suspicious";
  else if (severity >= 12 || order[maxSev] >= order.medium) verdict = "caution";
  else if (reputationOk.length > 0 || (input.localIsSufficient && input.enoughInput !== false)) verdict = "no_known_threat";
  else verdict = "inconclusive";

  // Confidence = quality/corroboration of evidence, independent from severity.
  let confidence: Confidence;
  let confidenceReason: string;
  const distinctSources = new Set(findings.filter((f) => order[f.severity] >= order.medium).map((f) => f.source));
  if (confirmed) {
    confidence = "high";
    confidenceReason = "A threat-intelligence provider reported a direct match for this subject.";
  } else if (findings.length && order[maxSev] >= order.medium) {
    const strong = findings.some((f) => order[f.severity] >= order.medium && f.confidence === "high");
    confidence = strong && (distinctSources.size > 1 || findings.filter((f) => order[f.severity] >= order.medium).length >= 2) ? "high" : strong || findings.length >= 3 ? "medium" : "low";
    confidenceReason = "Based on how many independent indicators agree and how reliable each indicator is. Heuristic indicators suggest risk but do not prove intent.";
  } else if (reputationOk.length > 0) {
    confidence = coveragePct >= 66 ? "medium" : "low";
    confidenceReason = `${reputationOk.length} reputation source(s) responded without a match. Absence of a listing is not evidence of safety – new threats are listed with delay.`;
  } else {
    confidence = "low";
    confidenceReason = input.localIsSufficient
      ? "Only local pattern analysis was possible. Absence of known indicators does not prove a message is genuine."
      : "No threat-intelligence source was available, so only local analysis ran.";
  }
  if (!confirmed && coveragePct < 50 && confidence === "high") {
    confidence = "medium";
    confidenceReason += " Confidence is capped because less than half of the sources returned data.";
  }

  const contributions: ScoreContribution[] = findings
    .filter((f) => f.severity !== "info")
    .map((f) => ({
      findingId: f.id,
      title: f.title,
      severity: f.severity,
      confidence: f.confidence,
      points: Math.round(SEVERITY_WEIGHT[f.severity] * CONFIDENCE_FACTOR[f.confidence] * 100),
    }));

  // Source disagreement
  const matched = reputationOk.filter((s) => s.result === "match");
  const clean = reputationOk.filter((s) => s.result === "no_match");
  const disagreement =
    matched.length && clean.length
      ? `${matched.map((s) => s.name).join(", ")} reported a match while ${clean.map((s) => s.name).join(", ")} did not. Providers use different data, collection methods and update speeds, so a listing in one source is still treated as a real warning.`
      : null;

  const oldest = okSources.map((s) => s.checkedAt).sort()[0] ?? null;
  const localOnly = externalOk.length === 0;
  const freshness = {
    label: oldest
      ? localOnly
        ? "Local rules evaluated at scan time (no external data used)"
        : `Live queries at scan time (${externalOk.length} external source${externalOk.length === 1 ? "" : "s"})`
      : "No data sources returned data",
    oldestSourceAt: oldest,
  };

  const summary = summarize(verdict, input.type, findings, localOnly);
  const recs = new Set<string>(input.recommendations ?? []);
  for (const f of findings.filter((f) => order[f.severity] >= order.medium).slice(0, 3)) recs.add(f.action);
  GENERAL_ACTIONS.forEach((a) => recs.add(a));
  if (verdict === "likely_malicious" || verdict === "high_risk") recs.add("If you already interacted, change affected passwords from a trusted device, enable two-factor authentication and contact your bank or provider if payment details were shared.");

  return {
    version: 1,
    type: input.type,
    subject: input.subject,
    createdAt: ts,
    verdict,
    verdictLabel: VERDICT_LABEL[verdict],
    summary,
    scores: { severity, confidence, confidenceReason, coveragePct, freshness },
    findings,
    sources: input.sources,
    threatMatches: input.threatMatches ?? [],
    technical: input.technical,
    explanation: {
      method:
        "Each finding carries a severity and a confidence rating. Findings are combined as independent evidence (risk = 1 − Π(1 − severity weight × confidence factor)). The verdict is derived from that risk value, with one exception: only a confirmed threat-intelligence match can produce “Likely Malicious”. Confidence, scanner coverage and data freshness are reported separately and never merged into the risk number.",
      contributions,
      disagreement,
    },
    recommendations: [...recs],
    limitations: [
      ...(input.limitations ?? []),
      "ScamLens never labels anything as safe. “No Known Threat Detected” only means the checks that ran found nothing – new or targeted threats may not be listed anywhere yet.",
      "HTTPS, a valid certificate or a professional look do not prove that a site or sender is trustworthy.",
    ],
    embeddedUrls: input.embeddedUrls,
    localOnly,
  };
}

function summarize(verdict: Verdict, type: ScanType, findings: Finding[], localOnly: boolean): string {
  const top = findings.filter((f) => f.severity !== "info").slice(0, 2).map((f) => f.title.toLowerCase());
  const subject = { url: "link", message: "message", qr: "QR code", domain: "domain", "email-header": "email headers" }[type];
  switch (verdict) {
    case "likely_malicious":
      return `A threat-intelligence source lists this ${subject} as dangerous. Do not interact with it.`;
    case "high_risk":
      return `Several strong warning signs were found in this ${subject}${top.length ? `: ${top.join("; ")}` : ""}. Treat it as dangerous until verified through an official channel.`;
    case "suspicious":
      return `This ${subject} shows warning signs${top.length ? ` (${top.join("; ")})` : ""}. Verify before you click, reply or pay.`;
    case "caution":
      return `Minor or weak warning signs were found${top.length ? ` (${top.join("; ")})` : ""}. They do not prove fraud, but verify before sharing information.`;
    case "no_known_threat":
      return `No known threat or warning pattern was detected in this ${subject}${localOnly ? " by local analysis" : ""}. This is not a guarantee of safety.`;
    default:
      return `ScamLens could not gather enough data to assess this ${subject}. Treat the result as unknown and verify independently.`;
  }
}
