import type { ReactNode } from "react";
import type { Severity, Verdict } from "@/lib/types";

export const btn = {
  primary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
  secondary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-fg transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50",
  ghost: "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-raised hover:text-fg",
  danger: "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-danger/50 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50",
};
export const input = "w-full min-h-11 rounded-md border border-line bg-panel px-3 py-2 text-sm text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export const VERDICT_VAR: Record<Verdict, string> = {
  likely_malicious: "var(--v-malicious)",
  high_risk: "var(--v-high)",
  suspicious: "var(--v-suspicious)",
  caution: "var(--v-caution)",
  no_known_threat: "var(--v-nothreat)",
  inconclusive: "var(--v-inconclusive)",
};
export const SEVERITY_VAR: Record<Severity, string> = {
  info: "var(--muted)",
  low: "var(--azure)",
  medium: "var(--warn)",
  high: "var(--v-high)",
  critical: "var(--danger)",
};

export function VerdictBadge({ verdict, label }: { verdict: Verdict; label: string }) {
  const c = VERDICT_VAR[verdict];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold" style={{ color: c, borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {label}
    </span>
  );
}

export function SeverityChip({ severity }: { severity: Severity }) {
  const c = SEVERITY_VAR[severity];
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>
      {severity}
    </span>
  );
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <Tag className={`rounded-lg border border-line bg-surface ${className}`}>{children}</Tag>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mono text-xs font-medium uppercase tracking-[0.14em] text-accent">{children}</p>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="bracket rounded-lg border border-dashed border-line bg-panel/50 p-8 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
