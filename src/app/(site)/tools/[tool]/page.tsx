import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { DomainTool } from "@/components/tools/DomainTool";
import { EmailTool } from "@/components/tools/EmailTool";
import { MessageTool } from "@/components/tools/MessageTool";
import { QrTool } from "@/components/tools/QrTool";
import { UrlTool } from "@/components/tools/UrlTool";
import { btn, Card, Eyebrow } from "@/components/ui";
import { getArticle } from "@/content/articles";
import { getTool, TOOLS } from "@/content/tools";
import { getSessionUser } from "@/lib/auth";
import { appJsonLd, breadcrumbJsonLd } from "@/lib/site";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const t = getTool((await params).tool);
  if (!t) return {};
  return { title: t.title, description: t.description, alternates: { canonical: `/tools/${t.slug}` }, openGraph: { title: t.title, description: t.description, url: `/tools/${t.slug}` } };
}

export default async function ToolLanding({ params }: { params: Promise<{ tool: string }> }) {
  const t = getTool((await params).tool);
  if (!t) notFound();
  const user = await getSessionUser();
  const signedIn = Boolean(user);
  const article = getArticle(t.related);
  const tool = { "url-scanner": <UrlTool signedIn={signedIn} />, "message-analyzer": <MessageTool signedIn={signedIn} />, "qr-code-checker": <QrTool signedIn={signedIn} />, "domain-intelligence": <DomainTool signedIn={signedIn} />, "email-header-analyzer": <EmailTool signedIn={signedIn} /> }[t.slug];
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <JsonLd data={[appJsonLd(`ScamLens ${t.name}`, t.description, `/tools/${t.slug}`), breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools/url-scanner" }, { name: t.name, path: `/tools/${t.slug}` }])]} />
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted"><Link href="/" className="hover:text-accent">Home</Link> / <span>Tools</span> / <span aria-current="page">{t.name}</span></nav>
      <Eyebrow>{t.module !== "+" ? `Module ${t.module}` : "Additional tool"} · {t.name}</Eyebrow>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t.h1}</h1>
      <p className="mt-4 rounded-lg border-l-4 border-accent bg-surface p-4 text-base">{t.answer}</p>
      <Card className="bracket mt-8 p-4 sm:p-5">{tool}</Card>
      <div className="prose-sl mt-12">
        <h2>How to use the {t.name}</h2>
        <ol>{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <h2>What ScamLens checks</h2>
        <ul>{t.checks.map((s) => <li key={s}>{s}</li>)}</ul>
        <h2>Frequently asked questions</h2>
        {t.faq.map((f) => <div key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>)}
        {article && <p>Related guide: <Link href={`/learn/${article.slug}`}>{article.title}</Link>. How results are calculated: <Link href="/methodology">methodology</Link>.</p>}
      </div>
      <div className="mt-8 flex flex-wrap gap-3"><Link href={t.appPath} className={btn.primary}>Open in the app</Link><Link href="/learn" className={btn.secondary}>Security Center</Link></div>
    </div>
  );
}
