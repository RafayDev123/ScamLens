import { parse } from "tldts";
import { redactEmail, truncate } from "@/lib/security/redact";
import { findLookalikes } from "./lookalike";
import type { RawFinding } from "./url";

export interface ParsedHeaders {
  fields: Record<string, string[]>;
  received: { raw: string; from: string | null; by: string | null; date: string | null }[];
}

export function parseHeaders(raw: string): ParsedHeaders {
  const unfolded = raw.replace(/\r\n/g, "\n").replace(/\n[ \t]+/g, " ");
  const fields: Record<string, string[]> = {};
  for (const line of unfolded.split("\n")) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase();
    (fields[k] ??= []).push(m[2].trim());
  }
  const received = (fields["received"] ?? []).map((r) => ({
    raw: r,
    from: r.match(/\bfrom\s+(\S+)/i)?.[1] ?? null,
    by: r.match(/\bby\s+(\S+)/i)?.[1] ?? null,
    date: r.split(";").pop()?.trim() ?? null,
  }));
  return { fields, received };
}

const EMAIL_RE = /([A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;
/** The real address is the one inside <...>; display names may contain a different (fake) address. */
function addrOf(v: string | undefined): string | null {
  if (!v) return null;
  const angle = v.match(/<([^<>]+)>/)?.[1];
  const m = (angle && angle.match(EMAIL_RE)) ?? v.match(EMAIL_RE);
  return m ? m[1].toLowerCase() : null;
}
function addrDomain(v: string | undefined): string | null {
  return addrOf(v)?.split("@")[1] ?? null;
}
const reg = (d: string | null) => (d ? parse(d).domain ?? d : null);

export interface AuthResult { mechanism: "spf" | "dkim" | "dmarc"; result: string; detail: string }

export function analyzeEmailHeaders(raw: string): { findings: RawFinding[]; technical: Record<string, unknown>; ok: boolean } {
  const { fields, received } = parseHeaders(raw);
  const findings: RawFinding[] = [];
  const src = "local-header-analysis";
  const add = (f: Omit<RawFinding, "source" | "category">) => findings.push({ source: src, category: "email", ...f });

  const authHeaders = fields["authentication-results"] ?? [];
  const auth: AuthResult[] = [];
  for (const mech of ["spf", "dkim", "dmarc"] as const) {
    for (const h of authHeaders) {
      const m = h.match(new RegExp(`\\b${mech}=(\\w+)([^;]*)`, "i"));
      if (m) { auth.push({ mechanism: mech, result: m[1].toLowerCase(), detail: truncate(m[2].trim(), 160) }); break; }
    }
  }
  const receivedSpf = fields["received-spf"]?.[0]?.match(/^(\w+)/)?.[1]?.toLowerCase();
  if (!auth.some((a) => a.mechanism === "spf") && receivedSpf) auth.push({ mechanism: "spf", result: receivedSpf, detail: "from Received-SPF header" });

  const from = fields["from"]?.[0];
  const replyTo = fields["reply-to"]?.[0];
  const returnPath = fields["return-path"]?.[0];
  const messageId = fields["message-id"]?.[0];
  const fromDomain = addrDomain(from);
  const replyDomain = addrDomain(replyTo);
  const rpDomain = addrDomain(returnPath);
  const midDomain = messageId?.match(/@([^>\s]+)>?/)?.[1]?.toLowerCase() ?? null;
  const dkimDomains = (fields["dkim-signature"] ?? []).map((s) => s.match(/\bd=([^;\s]+)/i)?.[1]?.toLowerCase()).filter(Boolean) as string[];

  const bad = new Set(["fail", "softfail", "permerror", "temperror"]);
  for (const a of auth) {
    const label = a.mechanism.toUpperCase();
    if (a.result === "pass") continue;
    if (a.mechanism === "dmarc" && a.result === "fail") {
      add({ code: "mail.dmarc_fail", title: "DMARC check failed", severity: "high", confidence: "high", evidence: `dmarc=${a.result} ${a.detail}`, explanation: "DMARC failure means the message did not align with the sending domain's published policy – a strong sign of spoofing, though forwarding or misconfigured mailing lists can also cause it.", action: "Do not trust the From address. Contact the sender through a known channel." });
    } else if (bad.has(a.result)) {
      add({ code: `mail.${a.mechanism}_${a.result}`, title: `${label} result: ${a.result}`, severity: a.mechanism === "spf" && a.result === "softfail" ? "low" : "medium", confidence: "medium", evidence: `${a.mechanism}=${a.result} ${a.detail}`, explanation: `${label} lets domain owners publish who may send mail for them. A non-pass result means this message did not satisfy that check; legitimate mail can fail after forwarding.`, action: "Treat requests in this email with caution and verify them out-of-band." });
    } else {
      add({ code: `mail.${a.mechanism}_${a.result}`, title: `${label} result: ${a.result}`, severity: "low", confidence: "low", evidence: `${a.mechanism}=${a.result}`, explanation: `${label} did not produce a pass. “none” usually means the domain does not publish or the receiver did not evaluate this mechanism.`, action: "Consider the other indicators in this report." });
    }
  }
  if (!auth.length) {
    add({ code: "mail.no_auth_results", title: "No authentication results found in the supplied headers", severity: "info", confidence: "medium", evidence: "Authentication-Results / Received-SPF missing", explanation: "Without these headers SPF, DKIM and DMARC cannot be judged. They are normally added by your receiving mail server – copy the full original headers, not a forwarded copy.", action: "Re-export the full headers (“show original” / “view source”) and analyze again." });
  }
  if (fromDomain && replyDomain && reg(fromDomain) !== reg(replyDomain)) {
    add({ code: "mail.reply_to_mismatch", title: "Reply-To goes to a different domain than From", severity: "medium", confidence: "medium", evidence: `From: ${redactEmail(addrOf(from) ?? "")}  Reply-To: ${redactEmail(addrOf(replyTo) ?? "")}`, explanation: "Replies would reach someone other than the apparent sender. Scammers use this to receive victim answers. Some legitimate services (support desks, newsletters) also do this.", action: "Do not reply until you have verified the sender independently." });
  }
  if (fromDomain && rpDomain && reg(fromDomain) !== reg(rpDomain)) {
    add({ code: "mail.return_path_mismatch", title: "Return-Path domain differs from From domain", severity: "low", confidence: "low", evidence: `From domain ${fromDomain} vs Return-Path ${rpDomain}`, explanation: "Bulk-mail providers legitimately use their own bounce domain. It is notable mainly when other checks also fail.", action: "Weigh together with SPF/DKIM/DMARC results." });
  }
  if (fromDomain && dkimDomains.length && !dkimDomains.some((d) => reg(d) === reg(fromDomain))) {
    add({ code: "mail.dkim_domain_mismatch", title: "DKIM signature domain does not match From domain", severity: "low", confidence: "low", evidence: `d=${dkimDomains.join(", ")} vs From ${fromDomain}`, explanation: "A valid DKIM signature from an unrelated domain proves little about the visible sender.", action: "Do not treat a DKIM pass alone as proof the sender is genuine." });
  }
  if (fromDomain && midDomain && reg(midDomain) !== reg(fromDomain)) {
    add({ code: "mail.message_id_mismatch", title: "Message-ID domain differs from From domain", severity: "low", confidence: "low", evidence: `Message-ID @${midDomain}`, explanation: "Often caused by hosted mail platforms. It can also reveal that the message was generated by a tool unrelated to the claimed sender.", action: "Treat as a weak signal." });
  }
  if (messageId && !/^<[^<>@\s]+@[^<>\s]+>$/.test(messageId)) {
    add({ code: "mail.message_id_format", title: "Malformed Message-ID", severity: "low", confidence: "low", evidence: truncate(messageId, 100), explanation: "Message-IDs should look like <unique@domain>. Malformed values can indicate custom or bulk mailing software.", action: "Weak signal only." });
  }
  const display = from?.match(/^"?([^"<]+?)"?\s*</)?.[1]?.trim();
  if (display && fromDomain) {
    const embedded = display.match(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/)?.[1]?.toLowerCase();
    if (embedded && reg(embedded) !== reg(fromDomain)) {
      add({ code: "mail.display_name_spoof", title: "Display name shows a different email address", severity: "high", confidence: "high", evidence: `Display name: ${truncate(display, 80)}`, explanation: "The name shown by most mail apps contains an address from another domain than the real sender, a trick to look trustworthy.", action: "Look at the actual sending address, not the display name." });
    }
    const look = findLookalikes(fromDomain);
    for (const m of look.matches.filter((x) => x.kind !== "punycode" && x.kind !== "different_tld")) {
      add({ code: `mail.sender_lookalike.${m.kind}`, title: `Sender domain resembles “${m.brand}”`, severity: m.severity, confidence: "medium", evidence: `${fromDomain} ≈ ${m.officialDomain}`, explanation: `${m.detail} Similarity alone does not prove impersonation.`, action: `If you expected ${m.brand}, contact it through its official website.` });
    }
  }
  if (!from) add({ code: "mail.no_from", title: "No From header found", severity: "info", confidence: "high", evidence: "From: missing", explanation: "The pasted text may not contain complete headers.", action: "Paste the entire header block." });

  const technical: Record<string, unknown> = {
    from: from ? redactEmail(addrOf(from) ?? "") + (display ? ` (display: ${truncate(display, 60)})` : "") : null,
    replyTo: replyTo ? redactEmail(addrOf(replyTo) ?? "") : null,
    returnPath: returnPath ? redactEmail(addrOf(returnPath) ?? "") : null,
    messageIdDomain: midDomain,
    authentication: auth,
    dkimSigningDomains: dkimDomains,
    receivedChain: received.slice(0, 15).map((r, i) => ({ hop: received.length - i, from: r.from, by: r.by, date: r.date })),
    receivedHops: received.length,
    headerCount: Object.values(fields).reduce((n, v) => n + v.length, 0),
  };
  return { findings, technical, ok: Object.keys(fields).length >= 2 };
}
