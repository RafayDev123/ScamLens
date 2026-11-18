import { and, eq, gt, isNull } from "drizzle-orm";
import { ApiError, readJson, route } from "@/lib/api";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { validatePassword } from "@/lib/auth";
import { hashPassword, sha256 } from "@/lib/security/crypto";
import { resetSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export const POST = route(
  "POST /api/auth/reset",
  async ({ req }) => {
    const body = await readJson(req, resetSchema);
    const pwError = validatePassword(body.password);
    if (pwError) throw new ApiError(422, "weak_password", pwError);
    const [t] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, sha256(body.token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
      .limit(1);
    if (!t) throw new ApiError(400, "invalid_token", "This reset link is invalid or has expired.");
    await db.update(users).set({ passwordHash: await hashPassword(body.password), updatedAt: new Date() }).where(eq(users.id, t.userId));
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, t.id));
    await db.delete(sessions).where(eq(sessions.userId, t.userId)); // sign out everywhere
    return { data: { reset: true } };
  },
  { limits: { guest: 10, user: 10 }, windowSec: 900 },
);
