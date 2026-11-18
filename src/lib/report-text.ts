import type { Report } from "@/lib/types";

/** Plain-text summary for "Copy report summary" (safe to import in client code). */
export function reportSummaryText(r: Report): string {
  return [
    `ScamLens report: ${r.verdictLabel}`,
    `Subject: ${r.subject}`,
    `Type: ${r.type} | Analyzed: ${r.createdAt}`,
    `Risk severity ${r.scores.severity}/100 | confidence ${r.scores.confidence} | coverage ${r.scores.coveragePct}%`,
    r.summary,
    ...r.findings.slice(0, 6).map((f) => `- [${f.severity}] ${f.title}`),
    "ScamLens never guarantees safety – verify through official channels.",
  ].join("\n");
}
