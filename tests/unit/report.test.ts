import { describe, expect, it } from "vitest";
import { buildReport, computeRisk } from "@/lib/analysis/report";
import type { RawFinding } from "@/lib/analysis/url";
import type { SourceStatus } from "@/lib/types";

const now = new Date().toISOString();
const local: SourceStatus = { id: "local-heuristics", name: "Local", kind: "local", status: "ok", detail: "", checkedAt: now };
const ext = (result: "match" | "no_match", id = "urlhaus"): SourceStatus => ({ id, name: id, kind: "external", status: "ok", detail: "", checkedAt: now, result });
const f = (over: Partial<RawFinding>): RawFinding => ({ code: "x", title: "t", severity: "low", confidence: "medium", evidence: "e", explanation: "x", source: "local-heuristics", action: "a", ...over });
const base = { type: "url" as const, subject: "https://example.com", technical: {} };

describe("risk scoring", () => {
  it("combines evidence as noisy-OR and is monotonic", () => {
    const a = computeRisk([{ severity: "medium", confidence: "medium" }]);
    const b = computeRisk([{ severity: "medium", confidence: "medium" }, { severity: "high", confidence: "high" }]);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(100);
    expect(computeRisk([])).toBe(0);
  });
  it("never reports 'safe': clean + no reputation source = Inconclusive", () => {
    const r = buildReport({ ...base, findings: [], sources: [local] });
    expect(r.verdict).toBe("inconclusive");
  });
  it("clean with a responding reputation source = No Known Threat Detected, with limitations", () => {
    const r = buildReport({ ...base, findings: [], sources: [local, ext("no_match")] });
    expect(r.verdict).toBe("no_known_threat");
    expect(r.scores.confidence).not.toBe("high");
    expect(r.limitations.join(" ")).toMatch(/never labels anything as safe/i);
  });
  it("only a confirmed provider match can be Likely Malicious", () => {
    const heur = buildReport({ ...base, findings: [f({ severity: "critical", confidence: "high" }), f({ severity: "high", confidence: "high" })], sources: [local] });
    expect(heur.verdict).not.toBe("likely_malicious");
    const ti = buildReport({ ...base, findings: [f({ severity: "critical", confidence: "high", confirmed: true, source: "URLhaus" })], sources: [local, ext("match")] });
    expect(ti.verdict).toBe("likely_malicious");
    expect(ti.scores.confidence).toBe("high");
  });
  it("explains provider disagreement", () => {
    const r = buildReport({ ...base, findings: [f({ severity: "critical", confidence: "high", confirmed: true })], sources: [local, ext("match", "urlhaus"), ext("no_match", "google-web-risk")] });
    expect(r.explanation.disagreement).toMatch(/did not/);
  });
  it("keeps severity, confidence, coverage and freshness separate", () => {
    const r = buildReport({ ...base, findings: [f({ severity: "medium" })], sources: [local, { ...ext("no_match"), status: "error" }] });
    expect(r.scores.coveragePct).toBe(50);
    expect(r.scores.freshness.label).toBeTruthy();
    expect(typeof r.scores.severity).toBe("number");
    expect(r.explanation.contributions[0].points).toBeGreaterThan(0);
  });
  it("test fixture matches never count as real reputation coverage", () => {
    const r = buildReport({ ...base, findings: [], sources: [local, { ...ext("no_match", "test-fixture"), kind: "local" }] });
    expect(r.verdict).toBe("inconclusive");
  });
  it("urgent-only message input is not escalated", () => {
    const r = buildReport({ type: "message", subject: "m", technical: {}, findings: [f({ code: "msg.urgency", severity: "low", confidence: "low" })], sources: [local], localIsSufficient: true });
    expect(["caution", "no_known_threat"]).toContain(r.verdict);
  });
});
