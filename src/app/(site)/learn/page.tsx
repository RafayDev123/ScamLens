import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Card, Eyebrow } from "@/components/ui";
import { ARTICLES, GLOSSARY } from "@/content/articles";
import { breadcrumbJsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security Center – Scam, Phishing and Online Safety Guides",
  description: "Original, practical guides on phishing, fake banking messages, QR code safety, job scams, domain impersonation, OTP safety and safe online payments.",
  alternates: { canonical: "/learn" },
};

export default function LearnIndex() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Security Center", path: "/learn" }])} />
      <Eyebrow>Security Center</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Learn to recognize scams</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">Plain-language guides written by the ScamLens editorial team, each with practical examples and references to trusted public sources. Last updated 2026-11-17.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ARTICLES.map((a) => (
          <Card key={a.slug} as="article" className="flex flex-col p-5">
            <p className="mono text-[11px] uppercase tracking-wider text-accent">{a.category}</p>
            <h2 className="mt-1 text-lg font-semibold"><Link href={`/learn/${a.slug}`} className="hover:text-accent">{a.title}</Link></h2>
            <p className="mt-2 flex-1 text-sm text-muted">{a.description}</p>
            <p className="mt-3 text-xs text-muted">Updated <time dateTime={a.updated}>{a.updated}</time></p>
          </Card>
        ))}
      </div>
      <section className="mt-16" aria-labelledby="gl"><h2 id="gl" className="text-2xl font-bold">Glossary</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">{GLOSSARY.map((g) => <div key={g.term} className="rounded-lg border border-line bg-surface p-4"><dt className="font-semibold">{g.term}</dt><dd className="mt-1 text-sm text-muted">{g.def}</dd></div>)}</dl>
      </section>
    </div>
  );
}
