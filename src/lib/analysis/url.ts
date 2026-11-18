import { domainToUnicode } from "node:url";
import { isIP } from "node:net";
import { parse } from "tldts";
import { getShorteners } from "@/config/brands";
import { redactUrl } from "@/lib/security/redact";
import type { Finding } from "@/lib/types";
import { findLookalikes } from "./lookalike";

export type RawFinding = Omit<Finding, "id" | "timestamp">;

export type ParsedUrl =
  | { ok: true; url: URL; original: string; assumedScheme: boolean }
  | { ok: false; code: string; message: string };

export function parseSubmittedUrl(input: string): ParsedUrl {
  const original = input.trim();
  if (!original) return { ok: false, code: "empty", message: "Enter a URL to analyze." };
  if (original.length > 2048) return { ok: false, code: "too_long", message: "URLs longer than 2048 characters are not supported." };
  if (/[\s\u0000-\u001f]/.test(original)) return { ok: false, code: "whitespace", message: "The URL contains spaces or control characters." };
  let candidate = original;
  let assumedScheme = false;
  const scheme = original.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(original)) {
    if (!/^https?:\/\//i.test(original)) {
      return { ok: false, code: "unsupported_scheme", message: `Only http:// and https:// links can be analyzed (got "${scheme[1].toLowerCase()}:").` };
    }
  } else {
    candidate = `https://${original.replace(/^\/\//, "")}`;
    assumedScheme = true;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, code: "invalid_url", message: "This does not look like a valid URL." };
  }
  if (!url.hostname || (!isIP(url.hostname.replace(/^\[|\]$/g, "")) && !url.hostname.includes("."))) {
    return { ok: false, code: "invalid_host", message: "The URL needs a full domain name such as example.com." };
  }
  return { ok: true, url, original, assumedScheme };
}

/** Canonical form for comparison: lowercased host, no credentials/fragment/default port, tracking params removed, params sorted. */
export function canonicalizeUrl(url: URL): string {
  const u = new URL(url.toString());
  u.username = "";
  u.password = "";
  u.hash = "";
  const keep: [string, string][] = [];
  u.searchParams.forEach((v, k) => {
    if (!/^(utm_|fbclid$|gclid$|mc_eid$|igshid$)/i.test(k)) keep.push([k, v]);
  });
  keep.sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of keep) u.searchParams.append(k, v);
  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/$/, "");
  u.pathname = path;
  return u.toString();
}

/** URL without credentials/fragment – what may leave the server (providers, redirect inspection). */
export function outboundUrl(url: URL): string {
  const u = new URL(url.toString());
  u.username = "";
  u.password = "";
  u.hash = "";
  return u.toString();
}

export interface UrlParts {
  scheme: string;
  userinfo: string | null;
  subdomain: string;
  registrable: string;
  host: string;
  unicodeHost: string;
  port: string | null;
  path: string;
  query: string;
  fragment: string;
  isIp: boolean;
  tld: string;
}

const RISKY_TLDS = new Set(["tk", "ml", "ga", "cf", "gq", "top", "xyz", "zip", "mov", "click", "cam", "rest", "icu", "monster", "buzz", "country", "kim", "loan", "work", "support"]);
const SENSITIVE_PATH = /(login|log-in|signin|sign-in|verify|verification|secure|account|update|confirm|password|wallet|billing|payment|unlock|suspend|recover|validate|authenticate)/i;
const SENSITIVE_PARAMS = /^(password|passwd|pwd|pass|otp|pin|cvv|ssn|cnic|token|session|sessionid|sid|auth|access_token|api_key|apikey|secret)$/i;

export function splitUrl(url: URL): UrlParts {
  const hostAscii = url.hostname.replace(/^\[|\]$/g, "");
  const p = parse(hostAscii);
  const isIp = Boolean(isIP(hostAscii));
  let unicodeHost = hostAscii;
  try {
    unicodeHost = domainToUnicode(hostAscii) || hostAscii;
  } catch {
    /* keep ascii */
  }
  return {
    scheme: url.protocol.replace(":", ""),
    userinfo: url.username ? `${url.username}${url.password ? ":" + url.password : ""}@` : null,
    subdomain: p.subdomain ?? "",
    registrable: p.domain ?? hostAscii,
    host: hostAscii,
    unicodeHost,
    port: url.port || null,
    path: url.pathname,
    query: url.search,
    fragment: url.hash,
    isIp,
    tld: p.publicSuffix ?? "",
  };
}

function scriptsIn(label: string): Set<string> {
  const s = new Set<string>();
  for (const ch of label) {
    if (/[a-z0-9-]/i.test(ch)) s.add("latin");
    else if (/\p{Script=Cyrillic}/u.test(ch)) s.add("cyrillic");
    else if (/\p{Script=Greek}/u.test(ch)) s.add("greek");
    else if (/\p{Script=Arabic}/u.test(ch)) s.add("arabic");
    else if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(ch)) s.add("cjk");
    else if (/\p{L}/u.test(ch)) s.add("other");
  }
  return s;
}

/** Local, offline structural analysis of a URL. Contacts nothing. */
export function analyzeUrlStructure(url: URL): { findings: RawFinding[]; parts: UrlParts; shortener: boolean } {
  const parts = splitUrl(url);
  const findings: RawFinding[] = [];
  const src = "local-heuristics";
  const push = (f: Omit<RawFinding, "source" | "category"> & { category?: string }) => findings.push({ source: src, category: "structure", ...f });
  const hostForEvidence = parts.unicodeHost;
  const shorteners = getShorteners();
  const isShortener = shorteners.includes(parts.registrable) || shorteners.includes(parts.host);

  if (parts.userinfo) {
    push({
      code: "url.credentials",
      title: "Credentials embedded before the host",
      severity: "high",
      confidence: "high",
      evidence: `${parts.scheme}://[credentials]@${parts.host}`,
      explanation: "Everything before the “@” sign is ignored when connecting – the real destination is the host after it. Attackers put a trusted-looking name in front to mislead readers.",
      action: "Do not open this link. Check the part after the “@” – that is where the link really goes.",
    });
  }
  if (parts.isIp) {
    push({
      code: "url.ip_host",
      title: "Link points to a raw IP address",
      severity: "medium",
      confidence: "medium",
      evidence: parts.host,
      explanation: "Legitimate services almost always use a domain name. Raw IP addresses are common in short-lived phishing and malware hosting, although some devices and test servers also use them.",
      action: "Ask the sender for the official website address instead of using this link.",
    });
  }
  const labels = parts.host.split(".");
  if (!parts.isIp) {
    const punyLabels = labels.filter((l) => l.startsWith("xn--"));
    if (punyLabels.length) {
      const mixed = parts.unicodeHost.split(".").some((l) => scriptsIn(l).size > 1);
      push({
        code: mixed ? "url.homograph" : "url.punycode",
        title: mixed ? "Mixed alphabets in one domain label (possible homograph attack)" : "Internationalized (punycode) domain",
        severity: mixed ? "high" : "medium",
        confidence: mixed ? "high" : "medium",
        evidence: `${parts.host}  →  ${hostForEvidence}`,
        explanation: mixed
          ? "A single domain label mixes letters from different alphabets (for example Latin + Cyrillic). This is a classic way to build domains that look identical to well-known brands."
          : "The domain uses non-ASCII characters, shown in the address bar as readable text but transmitted as “xn--” punycode. Many are legitimate; some imitate familiar names with look-alike characters.",
        action: "Compare the ASCII (xn--) form with the website you expect and type the official address manually.",
      });
    }
    if (/%[0-9a-f]{2}/i.test(url.host)) {
      push({ code: "url.encoded_host", title: "Percent-encoding in the host name", severity: "medium", confidence: "medium", evidence: parts.host, explanation: "Host names normally never need percent-encoding. Encoding is used to hide characters from quick visual inspection.", action: "Avoid the link and verify the destination through an official channel." });
    }
    if (parts.subdomain.split(".").filter(Boolean).length >= 4) {
      push({ code: "url.deep_subdomains", title: "Unusually many subdomain levels", severity: "low", confidence: "medium", evidence: parts.host, explanation: "Long chains of subdomains can bury the real registrable domain at the end, where hurried readers do not look.", action: `Look at the end of the host: the controlling domain is “${parts.registrable}”.` });
    }
    if ((parts.host.match(/-/g) ?? []).length >= 4) {
      push({ code: "url.many_hyphens", title: "Many hyphens in the domain", severity: "low", confidence: "low", evidence: parts.host, explanation: "Domains stuffed with hyphens and keywords (like secure-login-verify-account) are a frequent phishing style. It is a weak signal on its own.", action: "Treat with extra care if the link asks you to sign in or pay." });
    }
    if (parts.host.length > 45) {
      push({ code: "url.long_host", title: "Very long host name", severity: "low", confidence: "low", evidence: `${parts.host.length} characters`, explanation: "Very long host names can hide the important part of the address.", action: "Verify the registrable domain before interacting." });
    }
    if (RISKY_TLDS.has(parts.tld.split(".").pop() ?? "")) {
      push({ code: "url.risky_tld", title: `Domain ending “.${parts.tld}” is frequently abused`, severity: "low", confidence: "low", evidence: `.${parts.tld}`, explanation: "Some inexpensive or free domain endings are overrepresented in abuse reports. Plenty of legitimate sites use them too, so this is only a weak signal.", action: "Do not rely on the ending alone – check other findings." });
    }
    const look = findLookalikes(parts.host);
    for (const m of look.matches) {
      if (m.kind === "punycode") continue;
      push({
        code: `url.lookalike.${m.kind}`,
        title: m.kind === "misleading_subdomain" ? `Misleading subdomain mentions “${m.brand}”` : m.kind === "different_tld" ? `Same name as “${m.brand}” with a different domain ending` : `Domain resembles “${m.brand}”`,
        severity: m.severity,
        confidence: m.kind === "different_tld" || m.kind === "additional_words" ? "low" : "medium",
        evidence: `${parts.registrable}  ≈  ${m.officialDomain}`,
        explanation: `${m.detail} Similarity alone does not prove the site is affiliated with, or impersonating, ${m.brand}.`,
        action: `If you expected ${m.brand}, open its official site by typing the address yourself rather than using this link.`,
        category: "impersonation",
      });
    }
  }
  if (parts.port && !["80", "443"].includes(parts.port)) {
    push({ code: "url.unusual_port", title: "Unusual network port", severity: "low", confidence: "medium", evidence: `:${parts.port}`, explanation: "Public websites normally use the default web ports. Non-standard ports appear in temporary phishing kits and test servers, but also in some legitimate admin tools.", action: "Be cautious entering any information on this page." });
  }
  if (parts.scheme === "http") {
    push({ code: "url.no_https", title: "Connection is not encrypted (HTTP)", severity: "low", confidence: "high", evidence: "http://", explanation: "Data typed into this page could be read or altered in transit. Note that HTTPS does not make a site trustworthy either – it only encrypts the connection.", action: "Never enter passwords or payment details on an HTTP page." });
  }
  if (isShortener) {
    push({ code: "url.shortener", title: "Shortened link hides the final destination", severity: "low", confidence: "high", evidence: parts.registrable, explanation: "URL shorteners are used legitimately, but they also make it impossible to see where a link leads before clicking.", action: "Use the redirect inspection option to reveal the destination without opening it." });
  }
  const path = decodeURIComponentSafe(parts.path);
  if (SENSITIVE_PATH.test(path)) {
    push({ code: "url.sensitive_path", title: "Path contains account/verification keywords", severity: "low", confidence: "low", evidence: redactUrl(url.toString()).replace(/^https?:\/\/[^/]+/, "") || "/", explanation: "Words like login, verify or update are typical in phishing pages, but also in every real sign-in page. They matter mostly when combined with other signals.", action: "Only sign in on sites you reached by typing the official address." });
  }
  const names: string[] = [];
  url.searchParams.forEach((value, name) => {
    if (SENSITIVE_PARAMS.test(name)) names.push(name);
    if (/^https?:\/\//i.test(value) && /^(url|u|redirect|redirect_uri|return|next|continue|goto|dest|target|link)$/i.test(name)) {
      push({ code: "url.redirect_param", title: "Link embeds another URL (possible open redirect)", severity: "medium", confidence: "low", evidence: `${name}=${redactUrl(value)}`, explanation: "Parameters carrying a full second URL can be used to bounce visitors from a trusted-looking site to another destination.", action: "Check where the embedded address leads before continuing." });
    }
  });
  if (names.length) {
    push({ code: "url.sensitive_params", title: "Sensitive data names in query parameters", severity: "medium", confidence: "medium", evidence: names.join(", "), explanation: "Secrets such as passwords, PINs or tokens should never travel in a link. This either exposes private data or tries to pre-fill a fake form.", action: "Do not share this link, and do not submit credentials through it." });
  }
  if (url.href.length > 250) {
    push({ code: "url.long_url", title: "Extremely long URL", severity: "low", confidence: "low", evidence: `${url.href.length} characters`, explanation: "Very long URLs can hide the real destination or carry tracking/obfuscation data. It is a weak signal.", action: "Focus on the domain at the start of the link." });
  }
  if (/@/.test(parts.path) || /\/\/.*\/\//.test(parts.path)) {
    push({ code: "url.path_trick", title: "Suspicious characters in path", severity: "low", confidence: "low", evidence: parts.path.slice(0, 120), explanation: "An “@” or repeated slashes in the path are sometimes used to imitate a different address.", action: "Read the address from the start; the host ends at the first single “/”." });
  }
  return { findings, parts, shortener: isShortener };
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
