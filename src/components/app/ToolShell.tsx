import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui";

export function ToolShell({ module, title, intro, children }: { module: string; title: string; intro: string; children: ReactNode }) {
  return (
    <div>
      <Eyebrow>{module}</Eyebrow>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{intro}</p>
      <div className="bracket mt-6 rounded-lg border border-line bg-surface p-4 sm:p-5">{children}</div>
    </div>
  );
}
