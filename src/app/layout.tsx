import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE.name} – Phishing Link, Scam Message, QR and Domain Checker`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, title: `${SITE.name} – ${SITE.tagline}`, description: SITE.description, url: "/" },
  twitter: { card: "summary_large_image", title: `${SITE.name} – ${SITE.tagline}`, description: SITE.description },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#080E18" }, { media: "(prefers-color-scheme: light)", color: "#F3F6FA" }], width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem('sl_theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
