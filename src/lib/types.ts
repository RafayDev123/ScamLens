export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Confidence = "low" | "medium" | "high";
export type Verdict =
  | "likely_malicious"
  | "high_risk"
  | "suspicious"
  | "caution"
  | "no_known_threat"
  | "inconclusive";
export type ScanType = "url" | "message" | "qr" | "domain" | "email-header";

export const SCAN_TYPES: ScanType[] = ["url", "message", "qr", "domain", "email-header"];

export type SourceState = "ok" | "unavailable" | "not_configured" | "error" | "skipped";

export interface Finding {
  id: string;
  code: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  /** Exact evidence (already redacted). Rendered as escaped text only. */
  evidence: string;
  explanation: string;
  source: string;
  timestamp: string;
  action: string;
  /** True only for confirmed threat-intelligence matches from an external provider. */
  confirmed?: boolean;
  relatedUrl?: string;
  /** Category, e.g. "structure", "reputation", "domain", "message". */
  category?: string;
}

export interface SourceStatus {
  id: string;
  name: string;
  kind: "local" | "external";
  status: SourceState;
  detail: string;
  checkedAt: string;
  attribution?: string;
  /** For reputation providers: whether the subject matched a threat list. */
  result?: "match" | "no_match";
}

export interface ThreatMatch {
  provider: string;
  threatType: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface ScoreContribution {
  findingId: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  points: number;
}

export interface Report {
  id?: string;
  version: 1;
  type: ScanType;
  /** Redacted subject. */
  subject: string;
  createdAt: string;
  verdict: Verdict;
  verdictLabel: string;
  summary: string;
  scores: {
    /** Risk severity 0-100. Computed only from findings. See docs/ARCHITECTURE.md. */
    severity: number;
    /** Confidence in the assessment (evidence quality), independent of severity. */
    confidence: Confidence;
    confidenceReason: string;
    /** Share of applicable sources that returned usable data. */
    coveragePct: number;
    freshness: { label: string; oldestSourceAt: string | null };
  };
  findings: Finding[];
  sources: SourceStatus[];
  threatMatches: ThreatMatch[];
  technical: Record<string, unknown>;
  explanation: {
    method: string;
    contributions: ScoreContribution[];
    disagreement: string | null;
  };
  recommendations: string[];
  limitations: string[];
  embeddedUrls?: { display: string; host: string; localRisk: Severity; indicators: string[] }[];
  localOnly: boolean;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  likely_malicious: "Likely Malicious",
  high_risk: "High Risk",
  suspicious: "Suspicious",
  caution: "Caution",
  no_known_threat: "No Known Threat Detected",
  inconclusive: "Inconclusive",
};

export const SEVERITY_ORDER: Severity[] = ["info", "low", "medium", "high", "critical"];
