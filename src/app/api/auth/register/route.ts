import { eq } from "drizzle-orm";
import { ApiError, readJson, route } from "@/lib/api";
import { db } from "@/db";
import { auditLogs, userPreferences, users } from "@/db/schema";
import { createSession, roleForEmail, validatePassword } from "@/lib/auth";
import { hashPassword } from "@/lib/security/crypto";
import { ipHash } from "@/lib/security/ratelimit";
import { registerSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export const POST = route(
  "POST /api/auth/register",
  async ({ req, ip }) => {
    const body = await readJson(req, registerSchema);
    const email = body.email.trim().toLowerCase();
    const pwError = validatePassword(body.password);
    if (pwError) throw new ApiError(422, "weak_password", pwError);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new ApiError(409, "email_in_use", "An account with this email already exists. Try signing in.");
    const [u] = await db
      .insert(users)
      .values({ email, passwordHash: await hashPassword(body.password), displayName: body.displayName?.trim() || null, role: roleForEmail(email) })
      .returning({ id: users.id, email: users.email, role: users.role });
    await db.insert(userPreferences).values({ userId: u.id });
    await db.insert(auditLogs).values({ userId: u.id, action: "auth.register", ipHash: ipHash(ip) });
    await createSession(u.id);
    return { status: 201, data: { user: { id: u.id, email: u.email, role: u.role } } };
  },
  { limits: { guest: 10, user: 10 }, windowSec: 900 },
);
