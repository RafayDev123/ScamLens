import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; claim?: string }> }) {
  const sp = await searchParams;
  return <AuthForm mode="login" next={sp.next} claim={sp.claim} />;
}
