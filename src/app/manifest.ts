import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "ScamLens", short_name: "ScamLens", description: "Check Before You Click. Understand Before You Trust.", start_url: "/", display: "standalone", background_color: "#080E18", theme_color: "#080E18", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
