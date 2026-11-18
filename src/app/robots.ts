import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api", "/shared", "/login", "/register", "/forgot-password", "/reset-password"] }], sitemap: abs("/sitemap.xml") };
}
