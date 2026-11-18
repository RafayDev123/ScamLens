import { ArrowRight, Globe, Link2, Lock, Mail, MessageSquareWarning, QrCode, Route, ScanSearch, Scale, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { RiskGauge } from "@/components/report/visuals";
import { UrlTool } from "@/components/tools/UrlTool";
import { btn, Card, Eyebrow, SeverityChip } from "@/components/ui";
import { ARTICLES } from "@/content/articles";
import { TOOLS } from "@/content/tools";
import { getSessionUser } from "@/lib/auth";
import { appJsonLd, orgJsonLd, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "ScamLens – Phishing Link Checker, Scam Message, QR & Domain Analyzer" },
  description: "Analyze suspicious links, scam messages, QR codes, domains and email headers. ScamLens explains every warning sign with evidence – and never claims something is 100% safe.",
  alternates: { canonical: "/" },
};

const ICONS = [Link2, MessageSquareWarning, QrCode, Globe];
const FAQ = [
  { q: "How do I check if a link is suspicious?", a: "Paste it into the URL Scanner. ScamLens inspects the address, compares it with reference brand domains, queries configured threat-intelligence sources and can trace redirects with a restricted fetcher – without opening the page in your browser." },
  { q: "Can HTTPS websites be fraudulent?", a: "Yes. HTTPS only means the connection is encrypted. Criminals obtain HTTPS certificates too, so ScamLens never treats HTTPS as proof of trust." },
  { q: "Does ‘No Known Threat Detected’ mean a link is safe?", a: "No. It means the checks that ran found nothing. New threats can take time to appear in any database, so ScamLens never shows a ‘100% safe’ result." },
  { q: "Are my messages sent to an AI service?", a: "No. Message analysis runs on ScamLens' own rules. Numbers, e-mail addresses and link secrets are redacted before anything is stored." },
  { q: "Do I need an account?", a: "No. Guests can run limited scans. An account adds history, saved reports, private share links and API keys." },
  { q: "Which threat-intelligence sources are used?", a: "Providers such as Google Web Risk and URLhaus are used only when their API credentials are configured by the operator. If a provider is not configured, the report says so and the result is marked as local analysis only." },
];

export default async function Home() {
  const user = await getSessionUser();
  return (
    <>
      <JsonLd data={[...orgJsonLd(), appJsonLd(SITE.name, SITE.description, "/")]} />
      {/* 1-3 Hero with real scanner */}
      <section className="relative border-b border-line" aria-labelledby="hero-h">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <Eyebrow>Online scam detection &amp; digital safety</Eyebrow>
            <h1 id="hero-h" className="mt-3 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">Don&apos;t Trust Every Link. <span className="text-accent">Verify It.</span></h1>
            <p className="mt-5 max-w-xl text-lg text-muted">Analyze suspicious links, messages, QR codes and domains. Understand the warning signs before you interact.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#scanner" className={btn.primary}>Analyze a URL <ArrowRight size={16} aria-hidden /></a>
              <a href="#tools" className={btn.secondary}>Explore All Tools</a>
            </div>
            <ul className="mt-8 grid max-w-xl gap-3 text-sm text-muted sm:grid-cols-2">
              <li className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-accent" aria-hidden />Every finding comes with evidence and a reason.</li>
              <li className="flex gap-2"><Lock size={18} className="shrink-0 text-accent" aria-hidden />Messages are analysed locally – no third-party AI.</li>
              <li className="flex gap-2"><Scale size={18} className="shrink-0 text-accent" aria-hidden />Severity, confidence, coverage and freshness stay separate.</li>
              <li className="flex gap-2"><ScanSearch size={18} className="shrink-0 text-accent" aria-hidden />No “100% safe” verdicts – ever.</li>
            </ul>
          </div>
          <div id="scanner" className="bracket scroll-mt-24 rounded-lg border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold">Scan a link now – no sign-up needed</h2>
            <UrlTool signedIn={Boolean(user)} compact />
          </div>
        </div>
      </section>

      {/* 4 Five feature sections */}
      <section id="tools" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20" aria-labelledby="features-h">
        <Eyebrow>Five core modules</Eyebrow>
        <h2 id="features-h" className="mt-2 text-3xl font-bold tracking-tight">One report format for every kind of suspicion</h2>
        <p className="mt-3 max-w-2xl text-muted">Each module feeds the same explainable risk report, so you always see the evidence, the sources and the limits of the analysis.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {TOOLS.slice(0, 4).map((t, i) => {
            const Icon = ICONS[i];
            return (
              <Card key={t.slug} as="article" className="flex flex-col p-5">
                <div className="flex items-center gap-3"><span className="mono text-xs text-accent">MODULE {t.module}</span><Icon size={18} className="text-azure" aria-hidden /></div>
                <h3 className="mt-2 text-lg font-semibold"><Link href={`/tools/${t.slug}`} className="hover:text-accent">{t.name}</Link></h3>
                <p className="mt-2 flex-1 text-sm text-muted">{t.answer}</p>
                <div className="mt-4 flex gap-3 text-sm"><Link className="text-accent underline underline-offset-4" href={t.appPath}>Open tool</Link><Link className="text-muted underline underline-offset-4" href={`/tools/${t.slug}`}>How it works</Link></div>
              </Card>
            );
          })}
          <Card as="article" className="flex flex-col border-accent/40 p-5 md:col-span-2">
            <div className="flex items-center gap-3"><span className="mono text-xs text-accent">MODULE 05</span><ShieldCheck size={18} className="text-azure" aria-hidden /></div>
            <h3 className="mt-2 text-lg font-semibold">Explainable Risk Report</h3>
            <p className="mt-2 text-sm text-muted">Every analysis ends in a unified report: overall assessment, findings with evidence, technical details, how the assessment was reached, recommended actions – plus PDF/JSON export, print and private revocable share links. Six assessment levels, none of them “safe”: Likely Malicious, High Risk, Suspicious, Caution, No Known Threat Detected, Inconclusive.</p>
          </Card>
        </div>
      </section>

      {/* 5 Additional tools */}
      <section className="mx-auto max-w-6xl px-4 pt-20" aria-labelledby="more-h">
        <h2 id="more-h" className="text-2xl font-bold tracking-tight">More tools for deeper checks</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[{ icon: Mail, name: "Email Header Analyzer", body: "Read SPF, DKIM and DMARC results, Reply-To mismatches and the Received chain.", href: "/tools/email-header-analyzer" }, { icon: Route, name: "Short-link Inspector", body: "Reveal a shortened link's redirect chain through a restricted header-only fetcher.", href: "/tools/url-scanner" }, { icon: Globe, name: "Lookalike Domain Detector", body: "Compare a domain with a configurable list of reference brands: typos, substitutions, extra words, punycode.", href: "/tools/domain-intelligence" }].map((x) => (
            <Card key={x.name} className="p-5"><x.icon size={20} className="text-azure" aria-hidden /><h3 className="mt-3 font-semibold"><Link href={x.href} className="hover:text-accent">{x.name}</Link></h3><p className="mt-1 text-sm text-muted">{x.body}</p></Card>
          ))}
        </div>
      </section>

      {/* 6 How it works */}
      <section className="mx-auto max-w-6xl px-4 pt-20" aria-labelledby="how-h">
        <Eyebrow>How ScamLens works</Eyebrow>
        <h2 id="how-h" className="mt-2 text-3xl font-bold tracking-tight">From suspicious input to a reasoned answer</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {[["Validate", "Input is parsed, normalized and checked. Unsafe schemes and malformed values are rejected."], ["Collect", "Local heuristics run first. Configured providers, RDAP, DNS and TLS add external evidence – only with your consent where data leaves ScamLens."], ["Weigh", "Each finding has a severity and a confidence. They combine as independent evidence."], ["Explain", "You get findings, evidence, limitations and next steps – and the full scoring logic."]].map(([h, p], i) => (
            <li key={h} className="rounded-lg border border-line bg-surface p-4"><span className="mono text-2xl font-bold text-accent">0{i + 1}</span><h3 className="mt-1 font-semibold">{h}</h3><p className="mt-1 text-sm text-muted">{p}</p></li>
          ))}
        </ol>
      </section>

      {/* 7 Example report */}
      <section className="mx-auto max-w-6xl px-4 pt-20" aria-labelledby="demo-h">
        <Eyebrow>Example report</Eyebrow>
        <h2 id="demo-h" className="mt-2 text-3xl font-bold tracking-tight">What an explained result looks like</h2>
        <p className="mt-2 inline-block rounded border border-warn/50 bg-warn/10 px-2 py-1 text-xs"><b>DEMONSTRATION DATA</b> – fictional URL, not a real scan result.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
          <Card className="flex items-center justify-center p-4"><RiskGauge verdict="high_risk" label="High Risk" score={72} /></Card>
          <div className="space-y-3">
            {[{ sev: "high" as const, t: "Misleading subdomain mentions “PayPal”", ev: "login.paypal.com.account-check.example.net", why: "Only the domain right before the ending identifies who controls a site. Here that is example.net." }, { sev: "medium" as const, t: "Link passes through 3 redirects", ev: "short.example → track.example → account-check.example.net", why: "Redirect chains can hide the final destination." }].map((f) => (
              <Card key={f.t} className="p-4"><div className="flex items-center gap-2"><SeverityChip severity={f.sev} /><h3 className="text-[15px] font-semibold">{f.t}</h3></div><p className="bracket mono mt-2 break-all rounded-md border border-line bg-panel px-3 py-2 text-[13px]">{f.ev}</p><p className="mt-2 text-sm text-muted">{f.why}</p></Card>
            ))}
            <p className="text-xs text-muted">Real reports additionally show confidence, scanner coverage, data freshness, every source consulted, technical details and the scoring explanation.</p>
          </div>
        </div>
      </section>

      {/* 8-9 Privacy + methodology */}
      <section className="mx-auto mt-20 grid max-w-6xl gap-4 px-4 md:grid-cols-2" aria-label="Privacy and methodology">
        <Card as="section" className="p-6"><Eyebrow>Privacy &amp; security</Eyebrow><h2 className="mt-2 text-xl font-semibold">Built so the scanner can&apos;t be abused – or leak your data</h2><ul className="mt-3 space-y-2 text-sm text-muted"><li>• Query values, tokens and credentials in URLs are redacted before storage.</li><li>• QR images are decoded in your browser and never uploaded.</li><li>• Redirect inspection only reaches public addresses, pins DNS, re-validates every hop and never downloads page bodies.</li><li>• Guests&apos; reports are deleted after 24 hours; accounts control retention and can delete everything.</li></ul><Link href="/privacy" className="mt-4 inline-block text-sm text-accent underline underline-offset-4">Read retention rules</Link></Card>
        <Card as="section" className="p-6"><Eyebrow>Trust &amp; methodology</Eyebrow><h2 className="mt-2 text-xl font-semibold">Honest about what it can&apos;t know</h2><ul className="mt-3 space-y-2 text-sm text-muted"><li>• Severity, confidence, coverage and freshness are never merged into one number.</li><li>• Only a confirmed external listing can produce “Likely Malicious”.</li><li>• Missing providers are shown as “configuration required” – never faked.</li><li>• Where sources disagree, the report says so.</li></ul><Link href="/methodology" className="mt-4 inline-block text-sm text-accent underline underline-offset-4">Read the methodology</Link></Card>
      </section>

      {/* 10 FAQ */}
      <section className="mx-auto max-w-3xl px-4 pt-20" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-3xl font-bold tracking-tight">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-line rounded-lg border border-line bg-surface">
          {FAQ.map((f) => <details key={f.q} className="group p-4"><summary className="cursor-pointer list-none font-medium marker:hidden">{f.q}</summary><p className="mt-2 text-sm text-muted">{f.a}</p></details>)}
        </div>
      </section>

      {/* 11 Education */}
      <section className="mx-auto max-w-6xl px-4 pt-20" aria-labelledby="learn-h">
        <div className="flex items-end justify-between gap-4"><h2 id="learn-h" className="text-3xl font-bold tracking-tight">Security Center</h2><Link href="/learn" className="text-sm text-accent underline underline-offset-4">All guides</Link></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ARTICLES.slice(0, 4).map((a) => <Card key={a.slug} as="article" className="p-4"><p className="mono text-[11px] uppercase text-accent">{a.category}</p><h3 className="mt-1 text-[15px] font-semibold"><Link href={`/learn/${a.slug}`} className="hover:text-accent">{a.title}</Link></h3><p className="mt-2 line-clamp-3 text-sm text-muted">{a.answer}</p></Card>)}
        </div>
      </section>

      {/* 12 Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="bracket rounded-lg border border-line bg-panel p-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Got a message you&apos;re unsure about?</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">Check it before you click, reply or pay. Guests can scan without signing up.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/app/url-scanner" className={btn.primary}>Analyze a URL</Link><Link href="/app/message-analyzer" className={btn.secondary}>Analyze a message</Link></div>
        </div>
      </section>
    </>
  );
}
