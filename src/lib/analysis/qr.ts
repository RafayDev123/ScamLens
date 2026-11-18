import { truncate } from "@/lib/security/redact";
import type { RawFinding } from "./url";

export type QrContentType = "url" | "wifi" | "phone" | "sms" | "email" | "contact" | "payment" | "geo" | "calendar" | "text" | "unsafe-scheme";

export interface QrClassification {
  type: QrContentType;
  label: string;
  /** Safe-to-display fields (secrets masked). */
  fields: Record<string, string>;
  url?: string;
  findings: RawFinding[];
}

const LABELS: Record<QrContentType, string> = {
  url: "Website link", wifi: "Wi-Fi configuration", phone: "Telephone number", sms: "SMS message", email: "Email address",
  contact: "Contact card", payment: "Payment request", geo: "Location", calendar: "Calendar event", text: "Plain text", "unsafe-scheme": "Executable / unsafe scheme",
};

/** Classify decoded QR text. Nothing is opened, called or submitted. */
export function classifyQr(content: string): QrClassification {
  const text = content.trim().slice(0, 4000);
  const lower = text.toLowerCase();
  const findings: RawFinding[] = [];
  const f = (x: Omit<RawFinding, "source" | "category">) => findings.push({ source: "local-qr-analysis", category: "qr", ...x });
  const base = (type: QrContentType, fields: Record<string, string> = {}, url?: string): QrClassification => ({ type, label: LABELS[type], fields, url, findings });

  if (/^(javascript|data|vbscript|file|blob):/i.test(text)) {
    f({ code: "qr.unsafe_scheme", title: "QR contains a script or local-file scheme", severity: "high", confidence: "high", evidence: truncate(text.replace(/[\u0000-\u001f]/g, " "), 120), explanation: "Normal QR codes contain web links or contact data. Script, data and file schemes can run code or expose local content in some apps.", action: "Do not open this QR code with any app." });
    return base("unsafe-scheme", { content: truncate(text, 200) });
  }
  if (/^https?:\/\//i.test(text) && !/\s/.test(text)) return base("url", {}, text);
  if (/^www\.[^\s]+$/i.test(text)) return base("url", {}, `https://${text}`);
  if (lower.startsWith("wifi:")) {
    const get = (k: string) => text.match(new RegExp(`(?:^|;|:)${k}:((?:\\\\.|[^;])*)`, "i"))?.[1] ?? "";
    const enc = get("T") || "none";
    f({ code: "qr.wifi", title: "Joining this Wi-Fi network is a trust decision", severity: enc.toLowerCase() === "nopass" || enc === "none" ? "medium" : "low", confidence: "medium", evidence: `SSID “${truncate(get("S"), 40)}”, security ${enc}`, explanation: "A QR code can pre-fill network name and password. Attackers can set up a look-alike hotspot that intercepts traffic. Open networks give no encryption.", action: "Join only networks you recognize and whose name you confirmed with the venue." });
    return base("wifi", { network: truncate(get("S"), 60), security: enc, password: get("P") ? "•••• (hidden)" : "none", hidden: get("H") || "false" });
  }
  if (lower.startsWith("tel:")) {
    f({ code: "qr.phone", title: "QR would dial a phone number", severity: "low", confidence: "medium", evidence: truncate(text, 60), explanation: "Calling unknown numbers can lead to premium-rate charges or vishing. ScamLens never places the call.", action: "Only call numbers you have verified independently." });
    return base("phone", { number: truncate(text.slice(4), 40) });
  }
  if (/^(sms|smsto|mms):/i.test(text)) {
    f({ code: "qr.sms", title: "QR would prepare an SMS", severity: "low", confidence: "medium", evidence: truncate(text, 100), explanation: "Pre-filled SMS messages can subscribe you to paid services or send codes to a third party.", action: "Read the number and body carefully before sending anything." });
    return base("sms", { content: truncate(text, 160) });
  }
  if (lower.startsWith("mailto:") || /^matmsg:/i.test(text)) {
    f({ code: "qr.email", title: "QR would compose an email", severity: "low", confidence: "low", evidence: truncate(text, 100), explanation: "A pre-filled email may impersonate you or lead you to reply to a scammer.", action: "Check the address and message text before sending." });
    return base("email", { content: truncate(text.replace(/^mailto:/i, ""), 120) });
  }
  if (/^BEGIN:VCARD/i.test(text) || /^MECARD:/i.test(text)) {
    return base("contact", { name: text.match(/(?:^|\n)(?:FN:|N:)([^\n;]+)/i)?.[1] ?? text.match(/N:([^;]+)/)?.[1] ?? "unknown", content: truncate(text, 200) });
  }
  if (/^(upi|bitcoin|ethereum|litecoin|monero|paypal|pay|tez):/i.test(text) || /^upi:\/\//i.test(text)) {
    f({ code: "qr.payment", title: "QR contains a payment request", severity: "medium", confidence: "medium", evidence: truncate(text.replace(/(pa=)[^&]+/i, "$1[payee]"), 140), explanation: "Payment QR codes can be pasted over genuine ones. Scammers also send “receive money” QR codes that actually move money out of your account.", action: "Confirm the payee name and amount in your payment app, and never scan a QR code to “receive” money." });
    return base("payment", { scheme: text.split(":")[0], content: truncate(text, 140) });
  }
  if (lower.startsWith("geo:")) return base("geo", { content: truncate(text, 80) });
  if (/^BEGIN:VEVENT/i.test(text)) return base("calendar", { content: truncate(text, 160) });
  // Plain text that contains a URL somewhere
  const embedded = text.match(/https?:\/\/[^\s]+/i)?.[0];
  if (embedded) {
    f({ code: "qr.text_with_url", title: "Text with an embedded link", severity: "low", confidence: "low", evidence: truncate(text, 140), explanation: "The QR holds free text that includes a link rather than only a link.", action: "Analyze the embedded link separately." });
    return base("text", { content: truncate(text, 300) }, embedded);
  }
  return base("text", { content: truncate(text, 300) });
}
