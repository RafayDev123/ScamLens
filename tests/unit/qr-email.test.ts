import { describe, expect, it } from "vitest";
import { classifyQr } from "@/lib/analysis/qr";
import { analyzeEmailHeaders } from "@/lib/analysis/email-header";
import { normalizeDomainInput } from "@/lib/analysis/domain";

describe("QR classification", () => {
  it("URL", () => expect(classifyQr("https://example.com/pay").type).toBe("url"));
  it("Wi-Fi hides the password", () => {
    const c = classifyQr("WIFI:T:WPA;S:Cafe;P:hunter2secret;;");
    expect(c.type).toBe("wifi");
    expect(JSON.stringify(c)).not.toContain("hunter2secret");
  });
  it("phone, sms, email, payment, plain text", () => {
    expect(classifyQr("tel:+123456789").type).toBe("phone");
    expect(classifyQr("SMSTO:12345:hi").type).toBe("sms");
    expect(classifyQr("mailto:a@b.co").type).toBe("email");
    expect(classifyQr("upi://pay?pa=a@b&am=10").type).toBe("payment");
    expect(classifyQr("hello world").type).toBe("text");
  });
  it("flags javascript: payloads as unsafe and never extracts a URL", () => {
    const c = classifyQr("javascript:alert(document.cookie)");
    expect(c.type).toBe("unsafe-scheme");
    expect(c.url).toBeUndefined();
    expect(c.findings[0].severity).toBe("high");
  });
  it("text containing a URL exposes it for separate analysis", () => expect(classifyQr("Visit https://example.com now").url).toBe("https://example.com"));
});

const HEADERS = `Received: from mail.evil.example (mail.evil.example [203.0.113.9]) by mx.google.com with ESMTPS; Tue, 1 Oct 2024 10:00:00 +0000
Authentication-Results: mx.google.com; spf=fail smtp.mailfrom=evil.example; dkim=none; dmarc=fail header.from=paypal-secure.example
From: "PayPal Support support@paypal.com" <alerts@paypal-secure.example>
Reply-To: <collect@gmail.com>
Return-Path: <bounce@evil.example>
Message-ID: <abc@evil.example>
Subject: Verify now`;

describe("email header analyzer", () => {
  it("detects auth failures, reply-to mismatch and display-name spoofing", () => {
    const r = analyzeEmailHeaders(HEADERS);
    const codes = r.findings.map((f) => f.code);
    expect(r.ok).toBe(true);
    expect(codes).toEqual(expect.arrayContaining(["mail.dmarc_fail", "mail.spf_fail", "mail.reply_to_mismatch", "mail.display_name_spoof"]));
  });
  it("explains missing auth results instead of failing", () => {
    const r = analyzeEmailHeaders("From: a@example.com\nTo: b@example.com\nSubject: hi");
    expect(r.findings.map((f) => f.code)).toContain("mail.no_auth_results");
  });
});

describe("domain input", () => {
  it("normalizes URLs and unicode", () => {
    const n = normalizeDomainInput("https://Example.COM/path?x=1");
    expect(n.ok && n.ascii).toBe("example.com");
    const u = normalizeDomainInput("bücher.de");
    expect(u.ok && u.ascii).toBe("xn--bcher-kva.de");
  });
  it("rejects invalid input, IPs and non-public names", () => {
    for (const v of ["", "127.0.0.1", "localhost", "a b.com", "user@example.com", "foo.invalidtld123"]) expect(normalizeDomainInput(v).ok).toBe(false);
  });
});
