import { describe, expect, it } from "vitest";
import { analyzeUrlStructure, canonicalizeUrl, parseSubmittedUrl } from "@/lib/analysis/url";
import { findLookalikes, levenshtein, skeleton } from "@/lib/analysis/lookalike";
import { redactUrl } from "@/lib/security/redact";

const codes = (u: string) => {
  const p = parseSubmittedUrl(u);
  if (!p.ok) throw new Error(p.message);
  return analyzeUrlStructure(p.url).findings.map((f) => f.code);
};

describe("URL parsing", () => {
  it("accepts a valid https URL", () => expect(parseSubmittedUrl("https://example.com/a?b=1").ok).toBe(true));
  it("assumes https when no scheme is given", () => {
    const p = parseSubmittedUrl("example.com/login");
    expect(p.ok && p.assumedScheme).toBe(true);
  });
  it("rejects javascript:, data: and ftp: schemes", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,hi", "ftp://example.com"]) expect(parseSubmittedUrl(u).ok).toBe(false);
  });
  it("rejects empty, whitespace and garbage input", () => {
    for (const u of ["", "   ", "http://", "not a url", "http://localhost"]) expect(parseSubmittedUrl(u).ok).toBe(false);
  });
  it("canonicalizes: strips credentials, fragment, tracking params, sorts query", () => {
    const p = parseSubmittedUrl("HTTPS://user:pw@Example.com:443/a//b/?utm_source=x&z=1&a=2#frag");
    if (!p.ok) throw new Error("parse");
    expect(canonicalizeUrl(p.url)).toBe("https://example.com/a/b?a=2&z=1");
  });
});

describe("URL heuristics", () => {
  it("flags IP hosts and unusual ports", () => {
    const c = codes("http://203.0.113.5:8081/login");
    expect(c).toContain("url.ip_host");
    expect(c).toContain("url.unusual_port");
  });
  it("flags embedded credentials", () => expect(codes("https://paypal.com@evil.example.net/")).toContain("url.credentials"));
  it("flags punycode and mixed-script homographs", () => {
    expect(codes("https://xn--e1awd7f.com/")).toEqual(expect.arrayContaining([expect.stringMatching(/url\.(punycode|homograph)/)]));
    expect(codes("https://аpple.com/")).toContain("url.homograph");
  });
  it("flags misleading subdomains and typosquats", () => {
    expect(codes("https://paypal.com.account-verify.example.org/")).toContain("url.lookalike.misleading_subdomain");
    expect(codes("https://paypa1.com.verify-login.example.net/")).toContain("url.lookalike.misleading_subdomain");
    expect(codes("https://paypa1.com/")).toContain("url.lookalike.substitution");
    expect(codes("https://amazom.com/")).toContain("url.lookalike.typo");
  });
  it("recognizes shorteners", () => expect(codes("https://bit.ly/abc123")).toContain("url.shortener"));
  it("does not flag the official domain as a lookalike", () => {
    expect(codes("https://www.paypal.com/signin").filter((c) => c.startsWith("url.lookalike"))).toEqual([]);
  });
  it("flags sensitive params and open-redirect parameters", () => {
    const c = codes("https://example.com/r?password=abc&url=https://other.example/");
    expect(c).toContain("url.sensitive_params");
    expect(c).toContain("url.redirect_param");
  });
  it("never describes HTTPS as a trust signal", () => expect(codes("https://example.com/")).not.toContain("url.https_ok"));
});

describe("lookalike helpers", () => {
  it("levenshtein and skeleton behave", () => {
    expect(levenshtein("paypal", "paypa1")).toBe(1);
    expect(skeleton("pаypal")).toBe(skeleton("paypal"));
  });
  it("reports official reference without findings", () => {
    const r = findLookalikes("accounts.google.com");
    expect(r.officialReference?.brand).toBe("Google");
    expect(r.matches).toEqual([]);
  });
});

describe("redaction", () => {
  it("masks credentials, tokens and sensitive params", () => {
    const r = redactUrl("https://u:p@example.com/reset/abcdefghijklmnopqrstuvwxyz123456?token=SECRET&page=2#x");
    expect(r).not.toContain("SECRET");
    expect(r).not.toContain("u:p");
    expect(r).toContain("page=2");
    expect(r).toContain("[token]");
  });
});
