"use client";

import Link from "next/link";
import { useState } from "react";
import { btn, input } from "@/components/ui";

type Mode = "login" | "register" | "forgot" | "reset";
const COPY: Record<Mode, { title: string; cta: string }> = {
  login: { title: "Sign in", cta: "Sign in" },
  register: { title: "Create your account", cta: "Create account" },
  forgot: { title: "Reset your password", cta: "Send reset link" },
  reset: { title: "Choose a new password", cta: "Set new password" },
};

export function AuthForm({ mode, next = "/app", claim, token }: { mode: Mode; next?: string; claim?: string; token?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const body = mode === "login" ? { email, password } : mode === "register" ? { email, password, displayName: name || undefined } : mode === "forgot" ? { email } : { token, password };
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error?.details?.[0]?.message ?? j?.error?.message ?? "Something went wrong.");
        return;
      }
      if (mode === "forgot") {
        setInfo(`${j.data.message}${j.data.emailDelivery === "not_configured" ? " Note: email delivery is not configured on this deployment, so no email can be sent – contact the administrator." : " Check your inbox."}`);
        return;
      }
      if (mode === "reset") {
        setInfo("Password updated. You can sign in now.");
        return;
      }
      if (claim && /^[0-9a-f-]{36}$/i.test(claim)) {
        await fetch(`/api/v1/reports/${claim}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ saved: true }) }).catch(() => undefined);
      }
      window.location.href = safeNext;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-labelledby="auth-h">
      <h1 id="auth-h" className="text-2xl font-bold">{COPY[mode].title}</h1>
      {mode === "register" && <div><label htmlFor="name" className="mb-1 block text-sm font-medium">Name (optional)</label><input id="name" autoComplete="name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>}
      {mode !== "reset" && <div><label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label><input id="email" type="email" required autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} /></div>}
      {mode !== "forgot" && <div><label htmlFor="pw" className="mb-1 block text-sm font-medium">{mode === "reset" ? "New password" : "Password"}</label><input id="pw" type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} className={input} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "login" ? 1 : 10} aria-describedby="pwhint" />{mode !== "login" && <p id="pwhint" className="mt-1 text-xs text-muted">At least 10 characters, with letters and a number.</p>}</div>}
      <div aria-live="assertive">{error && <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-2 text-sm text-danger">{error}</p>}{info && <p role="status" className="rounded-md border border-ok/40 bg-ok/10 p-2 text-sm">{info}</p>}</div>
      <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? "Please wait…" : COPY[mode].cta}</button>
      <p className="text-center text-sm text-muted">
        {mode === "login" && <><Link className="text-accent underline" href="/register">Create account</Link> · <Link className="text-accent underline" href="/forgot-password">Forgot password?</Link></>}
        {mode === "register" && <>Already registered? <Link className="text-accent underline" href="/login">Sign in</Link></>}
        {(mode === "forgot" || mode === "reset") && <Link className="text-accent underline" href="/login">Back to sign in</Link>}
      </p>
      <p className="text-center text-xs text-muted">ScamLens never asks for your mailbox password or any OTP.</p>
    </form>
  );
}
