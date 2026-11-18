import { afterEach, describe, expect, it } from "vitest";
import { roleForEmail } from "@/lib/auth";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/security/crypto";
import { reportToPdf, pdfSafe } from "@/lib/report-pdf";
import { buildReport } from "@/lib/analysis/report";
import { redactText } from "@/lib/security/redact";
import { checkReputation, providerOverview } from "@/lib/providers";
import { scanUrl, scanMessage, scanQr } from "@/lib/services/scan-service";

const originalAdminEmails = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("admin allowlist", () => {
  it("uses the allowlist as the source of truth for admin roles", () => {
    process.env.ADMIN_EMAILS = "admin@example.com, allowed@example.com";
    expect(roleForEmail("ALLOWED@EXAMPLE.COM")).toBe("admin");
    expect(roleForEmail("other@example.com")).toBe("user");
  });
});

describe("crypto", () => {
  it("hashes and verifies passwords; tokens are unique and long", async () => {
    const h = await hashPassword("correct horse 1");
    expect(await verifyPassword("correct horse 1", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(h).not.toContain("correct horse");
    expect(randomToken().length).toBeGreaterThanOrEqual(43);
    expect(randomToken()).not.toBe(randomToken());
    expect(sha256("a")).toHaveLength(64);
  });
});

describe("providers: honest unavailable state", () => {
  it("reports configuration_required instead of fabricating results", async () => {
    delete process.env.WEB_RISK_API_KEY;
    delete process.env.URLHAUS_API_TOKEN;
    const r = await checkReputation("url", "https://example.com/", true);
    const wr = r.sources.find((s) => s.id === "google-web-risk");
    expect(wr?.status).toBe("not_configured");
    expect(r.matches).toEqual([]);
  });
  it("fixture produces a labelled, non-confirmed match", async () => {
    const rep = await checkReputation("url", "https://login.fixture.scamlens.test/", false);
    expect(rep.findings[0].confirmed).toBe(false);
    expect(rep.findings[0].source).toMatch(/fixture/i);
  });
  it("status overview never contains key material", () => {
    process.env.WEB_RISK_API_KEY = "SECRET-KEY-123";
    expect(JSON.stringify(providerOverview())).not.toContain("SECRET-KEY-123");
    delete process.env.WEB_RISK_API_KEY;
  });
  it("skips external providers when the user did not consent", async () => {
    process.env.URLHAUS_API_TOKEN = "x";
    const r = await checkReputation("url", "https://example.com/", false);
    expect(r.sources.find((s) => s.id === "urlhaus")?.status).toBe("skipped");
    delete process.env.URLHAUS_API_TOKEN;
  });
});

describe("services", () => {
  it("URL scan of an invalid URL throws a typed input error", async () => {
    await expect(scanUrl("javascript:alert(1)", { shareWithProviders: false, inspectRedirects: false })).rejects.toThrow(/Only http/);
  });
  it("URL scan keeps secrets out of the report", async () => {
    const r = await scanUrl("https://example.com/cb?access_token=TOPSECRET123456", { shareWithProviders: false, inspectRedirects: false });
    expect(JSON.stringify(r)).not.toContain("TOPSECRET123456");
    expect(r.localOnly).toBe(true);
  });
  it("fixture URL yields a report with a labelled test match", async () => {
    const r = await scanUrl("https://pay.fixture.scamlens.test/login", { shareWithProviders: false, inspectRedirects: false });
    expect(r.threatMatches[0].provider).toMatch(/fixture/i);
  });
  it("message scan rejects empty input and caps meaningless short input", async () => {
    await expect(scanMessage("   ")).rejects.toThrow();
    expect((await scanMessage("hi")).verdict).toBe("inconclusive");
  });
  it("QR with a javascript: payload is flagged, not analyzed as URL", async () => {
    const r = await scanQr("javascript:alert(1)", { shareWithProviders: false, inspectRedirects: false });
    expect(r.findings.some((f) => f.code === "qr.unsafe_scheme")).toBe(true);
  });
  it("QR Wi-Fi password never appears anywhere in the report", async () => {
    const r = await scanQr("WIFI:T:WPA;S:Cafe;P:hunter2secret;;", { shareWithProviders: false, inspectRedirects: false });
    expect(JSON.stringify(r)).not.toContain("hunter2secret");
  });
  it("QR containing plain text is analyzed locally", async () => {
    const r = await scanQr("Welcome to our cafe", { shareWithProviders: false, inspectRedirects: false });
    expect((r.technical as { contentType: string }).contentType).toBe("text");
  });
});

describe("report export", () => {
  it("generates a valid PDF even with non-Latin text", async () => {
    const r = buildReport({ type: "message", subject: "آپ کا اکاؤنٹ → ≈ “quoted”", findings: [], sources: [], technical: {}, localIsSufficient: true });
    const bytes = await reportToPdf(r);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfSafe("a→b")).toBe("a->b");
  });
  it("redactText hides personal data", () => {
    const t = redactText("Call +92 300 1234567 card 4111 1111 1111 1111 mail me@x.com otp 998877");
    expect(t).not.toMatch(/4111|1234567|me@|998877/);
  });
});
