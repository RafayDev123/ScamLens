import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { btn } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { TOOLS } from "@/content/tools";

const NAV = [
  { href: "/tools/url-scanner", label: "Tools" },
  { href: "/learn", label: "Learn" },
  { href: "/methodology", label: "Methodology" },
  { href: "/developers", label: "API" },
];

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="ScamLens home" className="rounded-md"><Logo /></Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-muted transition hover:bg-raised hover:text-fg">{n.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? <Link href="/app" className={btn.primary}>Open app</Link> : <><Link href="/login" className={`${btn.ghost} hidden sm:inline-flex`}>Sign in</Link><Link href="/app" className={btn.primary}>Open app</Link></>}
          <details className="relative md:hidden">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-line bg-surface" aria-label="Open menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-lg border border-line bg-surface p-2 shadow-xl">
              {NAV.map((n) => <Link key={n.href} href={n.href} className="block rounded-md px-3 py-3 text-sm hover:bg-raised">{n.label}</Link>)}
              {!user && <Link href="/login" className="block rounded-md px-3 py-3 text-sm hover:bg-raised">Sign in</Link>}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-panel/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted">Check Before You Click. Understand Before You Trust.</p>
          <p className="text-xs text-muted">ScamLens never labels anything as safe. Results are evidence-based assessments, not guarantees.</p>
        </div>
        <nav aria-label="Tools"><h2 className="mb-3 text-sm font-semibold">Tools</h2><ul className="space-y-2 text-sm text-muted">{TOOLS.map((t) => <li key={t.slug}><Link className="hover:text-accent" href={`/tools/${t.slug}`}>{t.name}</Link></li>)}</ul></nav>
        <nav aria-label="Resources"><h2 className="mb-3 text-sm font-semibold">Resources</h2><ul className="space-y-2 text-sm text-muted"><li><Link className="hover:text-accent" href="/learn">Security Center</Link></li><li><Link className="hover:text-accent" href="/methodology">Methodology</Link></li><li><Link className="hover:text-accent" href="/developers">Public API</Link></li><li><Link className="hover:text-accent" href="/privacy">Privacy &amp; retention</Link></li></ul></nav>
        <nav aria-label="Account"><h2 className="mb-3 text-sm font-semibold">Account</h2><ul className="space-y-2 text-sm text-muted"><li><Link className="hover:text-accent" href="/login">Sign in</Link></li><li><Link className="hover:text-accent" href="/register">Create account</Link></li><li><Link className="hover:text-accent" href="/app">Open app (guest scans allowed)</Link></li></ul></nav>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} ScamLens · Last content update 2026-11-17</div>
    </footer>
  );
}
