import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ArticleBody } from "@/components/site/ArticleBody";
import { ARTICLE_AUTHOR, ARTICLES, getArticle } from "@/content/articles";
import { abs, breadcrumbJsonLd, SITE } from "@/lib/site";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = getArticle((await params).slug);
  if (!a) return {};
  return { title: a.title, description: a.description, alternates: { canonical: `/learn/${a.slug}` }, openGraph: { type: "article", title: a.title, description: a.description, url: `/learn/${a.slug}`, publishedTime: a.published, modifiedTime: a.updated, authors: [ARTICLE_AUTHOR] } };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.description, datePublished: a.published, dateModified: a.updated, author: { "@type": "Organization", name: ARTICLE_AUTHOR }, publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: abs("/icon.svg") } }, mainEntityOfPage: abs(`/learn/${a.slug}`) };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={[ld, breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Security Center", path: "/learn" }, { name: a.title, path: `/learn/${a.slug}` }])]} />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted"><Link href="/" className="hover:text-accent">Home</Link> / <Link href="/learn" className="hover:text-accent">Security Center</Link> / <span aria-current="page">{a.category}</span></nav>
      <ArticleBody a={a} />
    </div>
  );
}
