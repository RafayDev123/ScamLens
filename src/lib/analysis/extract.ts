/** Pure helpers shared by browser and server (no Node-only imports). */

const URL_RE = /(?:https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,24}\/[^\s<>"'`]*)/gi;
const BARE_SHORT_RE = /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rb\.gy|t\.ly|shorturl\.at|wa\.me)\/[A-Za-z0-9_\-]+/gi;

/** Extract URLs from free text (max 20), trimming trailing punctuation. */
export function extractUrls(text: string): string[] {
  const found = new Set<string>();
  for (const re of [URL_RE, BARE_SHORT_RE]) {
    for (const m of text.matchAll(re)) {
      let u = m[0].replace(/[.,;:!?)\]}]+$/, "");
      if (!u) continue;
      if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
      found.add(u);
    }
  }
  // drop entries that are substrings-with-scheme duplicates (bare + scheme versions)
  return [...found].slice(0, 20);
}

/** Reads the first `[...]` label out of a decoded QR/URL payload type. Kept here so UI can reuse. */
export function looksLikeUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}
