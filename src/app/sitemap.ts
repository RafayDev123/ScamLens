import type { MetadataRoute } from "next";
import { ARTICLES } from "@/content/articles";
import { TOOLS } from "@/content/tools";
import { abs } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const d = new Date("2026-11-17");
  return [
    { url: abs("/"), lastModified: d, changeFrequency: "weekly", priority: 1 },
    ...TOOLS.map((t) => ({ url: abs(`/tools/${t.slug}`), lastModified: d, changeFrequency: "monthly" as const, priority: 0.9 })),
    { url: abs("/learn"), lastModified: d, changeFrequency: "weekly", priority: 0.8 },
    ...ARTICLES.map((a) => ({ url: abs(`/learn/${a.slug}`), lastModified: new Date(a.updated), changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: abs("/methodology"), lastModified: d, priority: 0.6 },
    { url: abs("/privacy"), lastModified: d, priority: 0.4 },
    { url: abs("/developers"), lastModified: d, priority: 0.5 },
  ];
}
