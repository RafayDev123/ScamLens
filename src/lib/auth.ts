import { cache } from "react";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/security/crypto";

export const SESSION_COOKIE = "sl_session";
export const GUEST_COOKIE = "sl_guest";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  role: "user" | "admin";
}

export function cookieOptions(maxAgeSec: number) {
  const secure = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: maxAgeSec };
}

export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export function roleForEmail(email: string): "user" | "admin" {
  return isAdminEmail(email) ? "admin" : "user";
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS * 86_400));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return { ...row, role: roleForEmail(row.email) };
}

/** Current signed-in user for server components / route handlers (deduplicated per request). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
});

export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (pw.length > 200) return "Password is too long.";
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number.";
  return null;
}
