"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BarDistribution({ data, label, colors }: { data: { name: string; value: number; key?: string }[]; label: string; colors?: Record<string, string> }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure aria-label={label}>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={{ stroke: "var(--line)" }} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--raised)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--fg)" }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>{data.map((d) => <Cell key={d.name} fill={colors?.[d.key ?? d.name] ?? "var(--accent)"} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{label}: {data.map((d) => `${d.name} ${d.value}`).join(", ")} (total {total})</figcaption>
    </figure>
  );
}
