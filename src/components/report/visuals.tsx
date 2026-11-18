import { format, formatDistanceToNowStrict } from "date-fns";
import type { Verdict } from "@/lib/types";
import { VERDICT_VAR } from "@/components/ui";

const RISK_ORDER: Verdict[] = ["no_known_threat", "caution", "suspicious", "high_risk", "likely_malicious"];
const SHORT: Record<Verdict, string> = { no_known_threat: "No known threat", caution: "Caution", suspicious: "Suspicious", high_risk: "High risk", likely_malicious: "Likely malicious", inconclusive: "Inconclusive" };

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

/** Lens-aperture gauge: five risk segments; the active one is lit. "Inconclusive" shows an empty gauge. */
export function RiskGauge({ verdict, label, score }: { verdict: Verdict; label: string; score: number }) {
  const active = RISK_ORDER.indexOf(verdict);
  const cx = 110, cy = 105, r = 84;
  const seg = 36;
  const color = VERDICT_VAR[verdict];
  const needleDeg = active >= 0 ? 180 - (active + 0.5) * seg : 90;
  const [nx, ny] = polar(cx, cy, r - 18, needleDeg);
  return (
    <figure className="mx-auto w-full max-w-[260px]" role="img" aria-label={`Overall assessment: ${label}. Risk severity ${score} out of 100.`}>
      <svg viewBox="0 0 220 128" className="w-full">
        {RISK_ORDER.map((v, i) => {
          const a1 = 180 - i * seg - 2;
          const a2 = 180 - (i + 1) * seg + 2;
          const [x1, y1] = polar(cx, cy, r, a1);
          const [x2, y2] = polar(cx, cy, r, a2);
          const lit = i === active;
          return <path key={v} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke={VERDICT_VAR[v]} strokeWidth={lit ? 15 : 9} strokeLinecap="butt" opacity={lit ? 1 : active === -1 ? 0.18 : 0.28} strokeDasharray={active === -1 ? "3 4" : undefined} />;
        })}
        <circle cx={cx} cy={cy} r="5" fill={color} />
        {active >= 0 && <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
        <text x={cx} y={cy - 26} textAnchor="middle" className="mono" fontSize="26" fontWeight="700" fill="var(--fg)">{active === -1 ? "?" : score}</text>
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize="8" fill="var(--muted)">{active === -1 ? "NOT ENOUGH DATA" : "RISK SEVERITY / 100"}</text>
        <text x="16" y="124" fontSize="7" fill="var(--muted)">{SHORT.no_known_threat}</text>
        <text x="204" y="124" fontSize="7" textAnchor="end" fill="var(--muted)">{SHORT.likely_malicious}</text>
      </svg>
      <figcaption className="-mt-1 text-center text-lg font-semibold" style={{ color }}>{label}</figcaption>
    </figure>
  );
}

export interface StructureParts { scheme: string; userinfo: string | null; subdomain: string; registrable: string; port: string | null; path: string; query: string; fragment: string }

/** URL structure inspector: shows which part of an address actually decides where you land. */
export function UrlInspector({ parts }: { parts: StructureParts }) {
  const chip = (text: string, label: string, tone: "muted" | "key" | "warn" = "muted") => (
    <span className="inline-flex flex-col items-start" key={label + text}>
      <span className={`mono rounded-sm px-1.5 py-1 text-[13px] break-all ${tone === "key" ? "bg-accent/15 text-accent underline decoration-accent decoration-2 underline-offset-4" : tone === "warn" ? "bg-danger/15 text-danger" : "bg-raised text-fg"}`}>{text}</span>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-muted">{label}</span>
    </span>
  );
  return (
    <div className="flex flex-wrap items-start gap-x-0.5 gap-y-2" role="group" aria-label="URL structure">
      {chip(`${parts.scheme}://`, "protocol", parts.scheme === "http" ? "warn" : "muted")}
      {parts.userinfo && chip(parts.userinfo, "credentials (ignored)", "warn")}
      {parts.subdomain && chip(`${parts.subdomain}.`, "subdomain")}
      {chip(parts.registrable, "registrable domain – decides the destination", "key")}
      {parts.port && chip(`:${parts.port}`, "port", ["80", "443"].includes(parts.port) ? "muted" : "warn")}
      {parts.path && parts.path !== "/" && chip(parts.path, "path")}
      {parts.query && chip(parts.query, "query")}
      {parts.fragment && chip(parts.fragment, "fragment")}
    </div>
  );
}

export interface Hop { url: string; status: number | null; location: string | null; ms: number; error?: string }

export function RedirectFlow({ hops, finalUrl, complete, stopReason }: { hops: Hop[]; finalUrl: string | null; complete: boolean; stopReason: string }) {
  return (
    <ol className="relative ml-3 space-y-3 border-l border-line pl-5" aria-label="Redirect chain">
      {hops.map((h, i) => {
        const redirect = h.status !== null && h.status >= 300 && h.status < 400;
        return (
          <li key={i} className="relative">
            <span aria-hidden className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 ${h.error ? "border-danger bg-danger/30" : i === hops.length - 1 ? "border-accent bg-accent" : "border-azure bg-surface"}`} />
            <p className="mono break-all text-[13px]">{h.url}</p>
            <p className="mt-0.5 text-xs text-muted">
              {h.status !== null ? <>HTTP <b className="text-fg">{h.status}</b>{redirect ? " – redirects onward" : ""}</> : <span className="text-danger">Not contacted / failed: {h.error?.replace(/[:_]/g, " ")}</span>} · {h.ms} ms
            </p>
          </li>
        );
      })}
      <li className="text-xs text-muted">
        {complete ? <>Final destination reached: <span className="mono text-fg break-all">{finalUrl}</span>. It was <b>not</b> opened in your browser.</> : <>Inspection stopped early: <b className="text-fg">{stopReason.replace(/[:_]/g, " ")}</b>.</>}
      </li>
    </ol>
  );
}

export interface TimelineEvent { label: string; date: string; tone: "ok" | "warn" | "muted" }

export function DomainTimeline({ events, now }: { events: TimelineEvent[]; now: number }) {
  const all = [...events.map((e) => ({ ...e, t: new Date(e.date).getTime() })), { label: "Today", date: new Date(now).toISOString(), tone: "muted" as const, t: now, today: true }].filter((e) => !Number.isNaN(e.t)).sort((a, b) => a.t - b.t);
  if (all.length <= 1) return <p className="text-sm text-muted">No dated registration or certificate events were available.</p>;
  return (
    <ol className="relative ml-3 space-y-4 border-l border-line pl-5" aria-label="Domain timeline">
      {all.map((e, i) => {
        const past = e.t <= now;
        const isToday = "today" in e;
        return (
          <li key={i} className="relative">
            <span aria-hidden className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 ${isToday ? "border-accent bg-accent" : e.tone === "warn" ? "border-warn bg-warn/30" : e.tone === "ok" ? "border-azure bg-azure/30" : "border-line bg-surface"}`} />
            <p className="text-sm font-medium">{e.label}</p>
            <p className="mono text-xs text-muted">{isToday ? format(e.t, "yyyy-MM-dd") : `${format(e.t, "yyyy-MM-dd")} · ${formatDistanceToNowStrict(e.t, { addSuffix: true })}`}{!past && !isToday ? "" : ""}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal meter for a 0..100 number with a text equivalent. */
export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted"><span>{label}</span><span className="mono text-fg">{value}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-azure" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
