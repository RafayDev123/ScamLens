/**
 * Reference list used ONLY to detect possible impersonation (similarity).
 * Similarity never proves affiliation or intent. Extend via EXTRA_BRANDS_JSON
 * (JSON array of { "name": string, "domains": string[] }).
 */
export interface BrandRef {
  name: string;
  domains: string[];
}

const BUILTIN: BrandRef[] = [
  { name: "PayPal", domains: ["paypal.com"] },
  { name: "Google", domains: ["google.com", "gmail.com", "youtube.com"] },
  { name: "Microsoft", domains: ["microsoft.com", "live.com", "outlook.com", "office.com"] },
  { name: "Apple", domains: ["apple.com", "icloud.com"] },
  { name: "Amazon", domains: ["amazon.com", "amazon.co.uk", "amazon.in"] },
  { name: "Facebook", domains: ["facebook.com", "fb.com"] },
  { name: "Instagram", domains: ["instagram.com"] },
  { name: "WhatsApp", domains: ["whatsapp.com", "whatsapp.net"] },
  { name: "Netflix", domains: ["netflix.com"] },
  { name: "LinkedIn", domains: ["linkedin.com"] },
  { name: "DHL", domains: ["dhl.com"] },
  { name: "FedEx", domains: ["fedex.com"] },
  { name: "UPS", domains: ["ups.com"] },
  { name: "Binance", domains: ["binance.com"] },
  { name: "Coinbase", domains: ["coinbase.com"] },
  { name: "Chase", domains: ["chase.com"] },
  { name: "Wells Fargo", domains: ["wellsfargo.com"] },
  { name: "Bank of America", domains: ["bankofamerica.com"] },
  { name: "HSBC", domains: ["hsbc.com"] },
  { name: "HBL", domains: ["hbl.com"] },
  { name: "UBL", domains: ["ubl.com.pk"] },
  { name: "Meezan Bank", domains: ["meezanbank.com"] },
  { name: "Allied Bank", domains: ["abl.com"] },
  { name: "Easypaisa", domains: ["easypaisa.com.pk"] },
  { name: "JazzCash", domains: ["jazzcash.com.pk"] },
  { name: "TCS", domains: ["tcsexpress.com"] },
  { name: "Leopards Courier", domains: ["leopardscourier.com"] },
  { name: "Daraz", domains: ["daraz.pk"] },
  { name: "FBR", domains: ["fbr.gov.pk"] },
  { name: "NADRA", domains: ["nadra.gov.pk"] },
];

export function getBrands(): BrandRef[] {
  const extra = process.env.EXTRA_BRANDS_JSON;
  if (!extra) return BUILTIN;
  try {
    const parsed = JSON.parse(extra) as unknown;
    if (Array.isArray(parsed)) {
      const ok = parsed.filter(
        (b): b is BrandRef =>
          typeof b === "object" &&
          b !== null &&
          typeof (b as BrandRef).name === "string" &&
          Array.isArray((b as BrandRef).domains) &&
          (b as BrandRef).domains.every((d) => typeof d === "string"),
      );
      return [...BUILTIN, ...ok];
    }
  } catch {
    /* invalid JSON: fall back to builtin list */
  }
  return BUILTIN;
}

const SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly",
  "shorturl.at", "tiny.cc", "rb.gy", "t.ly", "lnkd.in", "s.id", "v.gd", "bl.ink", "short.io", "wa.me",
];

/** Configurable: extend with EXTRA_SHORTENERS (comma separated hostnames). */
export function getShorteners(): string[] {
  const extra = (process.env.EXTRA_SHORTENERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...SHORTENERS, ...extra];
}
