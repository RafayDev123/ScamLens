import { eq } from "drizzle-orm";
import { ApiError, readJson, route } from "@/lib/api";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { createSession, isAdminEmail } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/security/crypto";
import { ipHash } from "@/lib/security/ratelimit";
import { loginSchema } from "@/lib/schemas";

export const runtime = "nodejs";

let dummyHash: Promise<string> | null = null;

export const POST = route(
  "POST /api/auth/login",
  async ({ req, ip }) => {
    const body = await readJson(req, loginSchema);
    const email = body.email.trim().toLowerCase();
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // constant-ish time: always run one scrypt verification
    dummyHash ??= hashPassword("not-a-real-password");
    const ok = await verifyPassword(body.password, u?.passwordHash ?? (await dummyHash));
    if (!u || !ok) {
      await db.insert(auditLogs).values({ userId: u?.id ?? null, action: "auth.login_failed", ipHash: ipHash(ip) }).catch(() => undefined);
      throw new ApiError(401, "invalid_credentials", "Email or password is incorrect.");
    }
    let role = u.role;
    if (isAdminEmail(email) && role !== "admin") {
      role = "admin";
      await db.update(users).set({ role }).where(eq(users.id, u.id));
    }
    await db.insert(auditLogs).values({ userId: u.id, action: "auth.login", ipHash: ipHash(ip) });
    await createSession(u.id);
    return { data: { user: { id: u.id, email: u.email, role } } };
  },
  { limits: { guest: 10, user: 10 }, windowSec: 900 },
);
