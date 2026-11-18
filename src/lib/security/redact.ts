/**
 * Privacy helpers. URLs and messages may contain tokens, session IDs, OTPs and
 * personal data. Everything that is stored, logged or displayed in a report
 * passes through these functions first.
 */

const SENSITIVE_PARAM = /(token|key|secret|session|sess|sid|auth|pass|pwd|otp|code|sig|signature|access|jwt|email|mail|phone|mobile|card|cvv|pin|ssn|cnic|user|uid|account|acct)/i;
const TOKEN_LIKE = /^[A-Za-z0-9_\-+/=.%]{16,}$/;
const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]]+/gi;

export function maskToken(value: string): string {
  if (value.length <= 4) return "•".repeat(value.length);
  return `${value.slice(0, 2)}${"•".repeat(Math.min(8, value.length - 3))}${value.slice(-1)}`;
}

export function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const hadCreds = Boolean(u.username || u.password);
    const protocol = u.protocol;
    const host = u.host;
    const path = u.pathname
      .split("/")
      .map((seg) => (seg.length >= 24 && TOKEN_LIKE.test(seg) ? "[token]" : seg))
      .join("/");
    const params: string[] = [];
    u.searchParams.forEach((value, name) => {
      const hide = SENSITIVE_PARAM.test(name) || TOKEN_LIKE.test(value) || value.length > 40;
      params.push(`${name}=${value === "" ? "" : hide ? "[redacted]" : value}`);
    });
    const search = params.length ? `?${params.join("&")}` : "";
    const hash = u.hash ? "#[fragment]" : "";
    return `${protocol}//${hadCreds ? "[credentials]@" : ""}${host}${path === "/" && !search && !hash ? "" : path}${search}${hash}`.slice(0, 600);
  } catch {
    return raw.replace(/([?&][^=&#]*=)[^&#]*/g, "$1[redacted]").slice(0, 300);
  }
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "[email]";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Redact personal / secret-like data from free text. Keeps wording intact for analysis. */
export function redactText(text: string): string {
  return text
    .replace(URL_IN_TEXT, (m) => {
      const clean = m.replace(/[.,;:!?]+$/, "");
      const trailing = m.slice(clean.length);
      const withProto = /^https?:\/\//i.test(clean) ? clean : `http://${clean}`;
      const red = redactUrl(withProto);
      return (/^https?:\/\//i.test(clean) ? red : red.replace(/^http:\/\//, "")) + trailing;
    })
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => redactEmail(m))
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[card-number]")
    .replace(/\b\d{5}-\d{7}-\d\b/g, "[cnic]")
    .replace(/(?<![\w.])\+?\d[\d\s-]{8,}\d(?![\w.])/g, "[phone-number]")
    .replace(/\b\d{6,}\b/g, "[number]");
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
