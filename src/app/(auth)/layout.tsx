import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 self-center" aria-label="ScamLens home"><Logo /></Link>
      <div className="bracket rounded-lg border border-line bg-surface p-6">{children}</div>
    </main>
  );
}
