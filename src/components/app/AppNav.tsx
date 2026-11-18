"use client";

import { BookOpen, FileText, Gauge, Globe, History, Link2, Mail, Menu, MessageSquareWarning, QrCode, Settings, Shield, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { btn } from "@/components/ui";

const ITEMS = [
  { href: "/app", label: "Overview", icon: Gauge, exact: true },
  { href: "/app/url-scanner", label: "URL Scanner", icon: Link2 },
  { href: "/app/message-analyzer", label: "Message Analyzer", icon: MessageSquareWarning },
  { href: "/app/qr-checker", label: "QR Checker", icon: QrCode },
  { href: "/app/domain-intelligence", label: "Domain Intelligence", icon: Globe },
  { href: "/app/email-headers", label: "Email Headers", icon: Mail },
  { href: "/app/reports", label: "Reports", icon: FileText },
  { href: "/app/history", label: "Scan History", icon: History },
  { href: "/app/security-center", label: "Security Center", icon: BookOpen },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppNav({ signedIn, isAdmin, name }: { signedIn: boolean; isAdmin: boolean; name: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the drawer after client-side navigation
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const items = isAdmin ? [...ITEMS, { href: "/app/admin", label: "Admin", icon: Shield }] : ITEMS;

  const list = (
    <nav aria-label="Application" className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active = "exact" in it && it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition ${active ? "bg-accent/12 font-semibold text-accent shadow-[inset_2px_0_0_var(--accent)]" : "text-muted hover:bg-raised hover:text-fg"}`}>
            <it.icon size={17} aria-hidden />{it.label}
          </Link>
        );
      })}
    </nav>
  );
  const account = signedIn ? (
    <div className="mt-4 border-t border-line pt-3 text-xs text-muted"><p className="truncate">Signed in{name ? ` as ${name}` : ""}</p><button className={`${btn.ghost} mt-1 w-full justify-start`} onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>Sign out</button></div>
  ) : (
    <div className="mt-4 space-y-2 border-t border-line pt-3"><p className="text-xs text-muted">Guest mode: limited scans, reports kept 24 h.</p><Link href="/login" className={`${btn.primary} w-full`}>Sign in</Link><Link href="/register" className={`${btn.secondary} w-full`}>Create account</Link></div>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/95 px-3 backdrop-blur lg:hidden no-print">
        <button className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}><Menu size={20} aria-hidden /></button>
        <Link href="/" aria-label="ScamLens home"><Logo /></Link>
        <ThemeToggle />
      </header>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside id="mobile-nav" role={open ? "dialog" : undefined} aria-modal={open ? true : undefined} aria-label="Navigation" className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto border-r border-line bg-panel p-3 transition-transform lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 no-print ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-4 flex items-center justify-between px-1"><Link href="/" aria-label="ScamLens home"><Logo /></Link><button className="inline-flex h-11 w-11 items-center justify-center rounded-md lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} aria-hidden /></button></div>
        {list}{account}
        <div className="mt-4 hidden lg:block"><ThemeToggle /></div>
      </aside>
    </>
  );
}
