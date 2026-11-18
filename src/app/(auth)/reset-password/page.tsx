import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Reset password" };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p className="text-sm">This reset link is missing its token. Request a new one.</p>;
  return <AuthForm mode="reset" token={token} />;
}
