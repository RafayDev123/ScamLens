import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string; claim?: string }> }) {
  const sp = await searchParams;
  return <AuthForm mode="register" next={sp.next} claim={sp.claim} />;
}
