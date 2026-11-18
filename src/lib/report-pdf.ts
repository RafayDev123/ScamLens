import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Report } from "@/lib/types";

const MAP: Record<string, string> = { "“": '"', "”": '"', "‘": "'", "’": "'", "→": "->", "≈": "~", "•": "*", "…": "...", "—": "-", "–": "-", "≥": ">=", "×": "x", "\u00a0": " " };

/** Standard PDF fonts only support WinAnsi; map or replace everything else so export never fails. */
export function pdfSafe(s: string): string {
  let out = "";
  for (const ch of s) {
    if (MAP[ch]) out += MAP[ch];
    else if (ch === "\n") out += " ";
    else if (/^[\x20-\x7e\xa1-\xff]$/.test(ch)) out += ch;
    else out += "?";
  }
  return out;
}

export async function reportToPdf(report: Report): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`ScamLens report - ${report.verdictLabel}`);
  pdf.setProducer("ScamLens");
  pdf.setCreator("ScamLens");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const W = 595, H = 842, M = 48;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (h: number) => {
    if (y - h < M + 20) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const wrap = (text: string, f: PDFFont, size: number, width: number): string[] => {
    const lines: string[] = [];
    for (const para of pdfSafe(text).split(/\s+/).reduce<string[]>((acc, w) => {
      const cur = acc[acc.length - 1];
      if (cur !== undefined && f.widthOfTextAtSize(`${cur} ${w}`, size) <= width) acc[acc.length - 1] = `${cur} ${w}`;
      else acc.push(w);
      return acc;
    }, [])) {
      // break very long unbroken tokens
      let p = para;
      while (f.widthOfTextAtSize(p, size) > width && p.length > 1) {
        let n = p.length;
        while (n > 1 && f.widthOfTextAtSize(p.slice(0, n), size) > width) n--;
        lines.push(p.slice(0, n));
        p = p.slice(n);
      }
      lines.push(p);
    }
    return lines;
  };
  const text = (t: string, opts: { size?: number; f?: PDFFont; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.f ?? font;
    const indent = opts.indent ?? 0;
    for (const line of wrap(t, f, size, W - 2 * M - indent)) {
      ensure(size + 4);
      page.drawText(line, { x: M + indent, y: y - size, size, font: f, color: rgb(...(opts.color ?? [0.1, 0.13, 0.18])) });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };
  const h2 = (t: string) => {
    ensure(30);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.7, 0.75, 0.8) });
    y -= 4;
    text(t.toUpperCase(), { size: 9, f: bold, color: [0.1, 0.5, 0.45], gap: 2 });
  };

  text("ScamLens", { size: 20, f: bold, color: [0.1, 0.5, 0.45] });
  text("Explainable security report", { size: 10, color: [0.4, 0.45, 0.5], gap: 8 });
  text(report.verdictLabel, { size: 22, f: bold, gap: 4 });
  text(report.summary, { size: 11, gap: 6 });

  h2("Overview");
  const rows: [string, string][] = [
    ["Subject", report.subject],
    ["Analysis type", report.type],
    ["Analyzed at", report.createdAt],
    ["Risk severity (0-100)", String(report.scores.severity)],
    ["Evidence confidence", `${report.scores.confidence} - ${report.scores.confidenceReason}`],
    ["Scanner coverage", `${report.scores.coveragePct}% of applicable sources returned data`],
    ["Data freshness", report.scores.freshness.label],
    ["Sources consulted", report.sources.map((s) => `${s.name} (${s.status.replace("_", " ")})`).join("; ") || "none"],
  ];
  for (const [k, v] of rows) {
    text(k, { size: 8, f: bold, color: [0.4, 0.45, 0.5] });
    text(v, { size: 10, f: k === "Subject" ? mono : font, gap: 2 });
  }

  h2(`Findings (${report.findings.length})`);
  if (!report.findings.length) text("No findings were produced by the checks that ran.", { gap: 4 });
  for (const f of report.findings) {
    ensure(60);
    text(`${f.severity.toUpperCase()} - ${f.title}`, { f: bold, size: 11 });
    text(`Source: ${f.source}   Confidence: ${f.confidence}   Time: ${f.timestamp}`, { size: 8, color: [0.4, 0.45, 0.5] });
    text(`Evidence: ${f.evidence}`, { f: mono, size: 9, indent: 8 });
    text(f.explanation, { indent: 8 });
    text(`Recommended: ${f.action}`, { indent: 8, f: bold, size: 9, gap: 6 });
  }

  h2("How this assessment was reached");
  text(report.explanation.method, { gap: 3 });
  for (const c of report.explanation.contributions) text(`- ${c.title}: ${c.severity}/${c.confidence} confidence, ~${c.points} points`, { size: 9, indent: 6 });
  if (report.explanation.disagreement) text(`Source disagreement: ${report.explanation.disagreement}`, { gap: 3 });

  h2("Recommended actions");
  for (const r of report.recommendations) text(`- ${r}`, { indent: 4 });

  h2("Limitations");
  for (const l of report.limitations) text(`- ${l}`, { indent: 4, size: 9 });

  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(pdfSafe(`ScamLens - never a guarantee of safety - page ${i + 1}/${pages.length}`), { x: M, y: 24, size: 8, font, color: rgb(0.5, 0.55, 0.6) }));
  return pdf.save();
}

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
