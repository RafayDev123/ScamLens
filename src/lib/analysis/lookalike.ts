import { parse } from "tldts";
import { getBrands, type BrandRef } from "@/config/brands";
import type { Severity } from "@/lib/types";

export type LookalikeKind =
  | "substitution"
  | "typo"
  | "additional_words"
  | "misleading_subdomain"
  | "different_tld"
  | "punycode";

export interface LookalikeMatch {
  brand: string;
  officialDomain: string;
  kind: LookalikeKind;
  detail: string;
  severity: Severity;
}

const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic
  а: "a", в: "b", с: "c", е: "e", һ: "h", і: "i", ј: "j", к: "k", м: "m", н: "h", о: "o", р: "p", ѕ: "s", т: "t", у: "y", х: "x", ԁ: "d", ӏ: "l", ԛ: "q", ԝ: "w",
  // Greek
  α: "a", β: "b", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x", ω: "w",
  // Other confusables
  ı: "i", ǀ: "l", ɡ: "g", ꓲ: "l",
};

/** Reduce a label to a visual "skeleton" so confusable spellings compare equal. */
export function skeleton(label: string): string {
  let s = label.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = [...s].map((c) => HOMOGLYPHS[c] ?? c).join("");
  s = s.replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d");
  return s.replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e").replace(/5/g, "s").replace(/\$/g, "s").replace(/@/g, "a").replace(/[-_]/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export interface LookalikeResult {
  matches: LookalikeMatch[];
  /** Registrable domain equals / is a subdomain of a reference domain. Not a safety guarantee. */
  officialReference: { brand: string; domain: string } | null;
  registrable: string | null;
}

/**
 * Compare a hostname (ASCII/punycode form) against the configurable brand list.
 * Similarity is a *signal*; it never proves that a domain is affiliated or malicious.
 */
export function findLookalikes(asciiHost: string, brands: BrandRef[] = getBrands()): LookalikeResult {
  const p = parse(asciiHost);
  const registrable = p.domain;
  const result: LookalikeResult = { matches: [], officialReference: null, registrable };
  if (!registrable) return result;
  const sld = (p.domainWithoutSuffix ?? "").toLowerCase();
  const subdomain = (p.subdomain ?? "").toLowerCase();
  const decodedSld = sld.startsWith("xn--") ? sld : sld;
  const seen = new Set<string>();
  const add = (m: LookalikeMatch) => {
    const k = `${m.brand}:${m.kind}`;
    if (!seen.has(k)) {
      seen.add(k);
      result.matches.push(m);
    }
  };

  for (const brand of brands) {
    if (brand.domains.some((d) => d.toLowerCase() === registrable)) {
      result.officialReference = { brand: brand.name, domain: registrable };
      continue;
    }
    const primary = brand.domains[0];
    const bp = parse(primary);
    const brandLabel = (bp.domainWithoutSuffix ?? "").toLowerCase();
    if (brandLabel.length < 3) continue;
    const skel = skeleton(decodedSld);
    const brandSkel = skeleton(brandLabel);
    const tokens = decodedSld.split(/[-_.]/).filter(Boolean);

    if (decodedSld === brandLabel) {
      add({ brand: brand.name, officialDomain: primary, kind: "different_tld", severity: "low", detail: `Uses the name "${brandLabel}" with a different domain ending (${p.publicSuffix}) than the reference domain ${primary}.` });
      continue;
    }
    if (brandLabel.length >= 4 && skel === brandSkel) {
      add({ brand: brand.name, officialDomain: primary, kind: "substitution", severity: "high", detail: `"${decodedSld}" looks like "${brandLabel}" after swapping look-alike characters (for example 0/o, 1/l, rn/m or non-Latin letters).` });
    } else if (brandLabel.length >= 5 && levenshtein(decodedSld, brandLabel) <= (brandLabel.length >= 9 ? 2 : 1) && Math.abs(decodedSld.length - brandLabel.length) <= 2) {
      add({ brand: brand.name, officialDomain: primary, kind: "typo", severity: levenshtein(decodedSld, brandLabel) === 1 ? "high" : "medium", detail: `"${decodedSld}" differs from "${brandLabel}" by only ${levenshtein(decodedSld, brandLabel)} character(s) – a common typosquatting pattern.` });
    } else if (tokens.includes(brandLabel) || (brandLabel.length >= 6 && decodedSld.includes(brandLabel))) {
      add({ brand: brand.name, officialDomain: primary, kind: "additional_words", severity: "medium", detail: `The domain "${registrable}" contains the name "${brandLabel}" combined with other words. Brand names inside longer domains are often used for impersonation, but can also be legitimate resellers or partners.` });
    }

    const subTokens = subdomain.split(/[.\-_]/).filter(Boolean);
    if (subdomain && (brand.domains.some((d) => subdomain.includes(d.toLowerCase())) || subTokens.includes(brandLabel) || (brandLabel.length >= 5 && subTokens.some((t) => skeleton(t) === brandSkel)) || (brandLabel.length >= 6 && subdomain.includes(brandLabel)))) {
      add({ brand: brand.name, officialDomain: primary, kind: "misleading_subdomain", severity: "high", detail: `"${brandLabel}" appears in the subdomain ("${subdomain}"), but the real domain is "${registrable}". Only the part right before the domain ending identifies who controls a site.` });
    }
  }

  if (asciiHost.split(".").some((l) => l.startsWith("xn--"))) {
    result.matches.push({ brand: "—", officialDomain: "—", kind: "punycode", severity: "medium", detail: "The hostname uses internationalized (punycode) labels. These are legitimate for many languages but are also used for visually deceptive domains." });
  }
  return result;
}
