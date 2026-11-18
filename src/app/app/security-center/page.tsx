import type { Metadata } from "next";
import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { ARTICLES } from "@/content/articles";

export const metadata: Metadata = { title: "Security Center" };

export default function Page() {
  return (
    <div>
      <Eyebrow>Learn</Eyebrow>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Security Center</h1>
      <p className="mt-2 text-sm text-muted">Original guides on recognizing scams. Also available publicly at <Link className="text-accent underline" href="/learn">/learn</Link>.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">{ARTICLES.map((a) => <Card key={a.slug} as="article" className="p-4"><p className="mono text-[11px] uppercase text-accent">{a.category}</p><h2 className="mt-1 font-semibold"><Link href={`/learn/${a.slug}`} className="hover:text-accent">{a.title}</Link></h2><p className="mt-1 text-sm text-muted">{a.answer}</p></Card>)}</div>
    </div>
  );
}
