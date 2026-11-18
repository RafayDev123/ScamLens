export const SITE = {
  name: "ScamLens",
  tagline: "Check Before You Click. Understand Before You Trust.",
  description: "ScamLens analyzes suspicious links, scam messages, QR codes, domains and email headers and explains every warning sign with evidence – so you can decide safely.",
  updated: "2026-11-17",
};

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const abs = (path: string) => `${siteUrl()}${path}`;

export function orgJsonLd() {
  return [
    { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: siteUrl(), logo: abs("/icon.svg"), description: SITE.description },
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: siteUrl(), description: SITE.description },
  ];
}

export function appJsonLd(name: string, description: string, path: string) {
  return { "@context": "https://schema.org", "@type": "SoftwareApplication", name, description, url: abs(path), applicationCategory: "SecurityApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free guest scans with daily limits" }, publisher: { "@type": "Organization", name: SITE.name } };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })) };
}
