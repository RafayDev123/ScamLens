import Link from "next/link";
import { ARTICLE_AUTHOR, type Article } from "@/content/articles";

export function ArticleBody({ a }: { a: Article }) {
  return (
    <article>
      <p className="mono text-xs uppercase tracking-wider text-accent">{a.category}</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{a.title}</h1>
      <p className="mt-3 text-sm text-muted">By {ARTICLE_AUTHOR} · Published <time dateTime={a.published}>{a.published}</time> · Updated <time dateTime={a.updated}>{a.updated}</time></p>
      <p className="mt-6 rounded-lg border-l-4 border-accent bg-surface p-4 text-base font-medium"><span className="sr-only">Short answer: </span>{a.answer}</p>
      <div className="prose-sl mt-6">
        {a.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((p, i) => <p key={i}>{p}</p>)}
            {s.list && <ul>{s.list.map((l) => <li key={l}>{l}</li>)}</ul>}
            {s.table && <table><thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>}
          </section>
        ))}
        <h2>Frequently asked questions</h2>
        {a.faq.map((f) => <div key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>)}
        <h2>References</h2>
        <ul>{a.references.map((r) => <li key={r.url}><a href={r.url} rel="noopener noreferrer" target="_blank">{r.label}</a></li>)}</ul>
      </div>
      <p className="mt-8 rounded-lg border border-line bg-panel p-4 text-sm text-muted">Have something suspicious right now? <Link className="text-accent underline" href="/app/url-scanner">Analyze a link</Link> or <Link className="text-accent underline" href="/app/message-analyzer">analyze a message</Link>. This guide is general education, not legal or financial advice.</p>
    </article>
  );
}
