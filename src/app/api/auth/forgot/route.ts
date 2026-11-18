import { eq } from "drizzle-orm";
import { readJson, route } from "@/lib/api";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { emailConfigured, sendEmail } from "@/lib/email";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { forgotSchema } from "@/lib/schemas";

export const runtime = "nodejs";

/** Always answers identically so account existence is never revealed. */
export const POST = route(
  "POST /api/auth/forgot",
  async ({ req }) => {
    const body = await readJson(req, forgotSchema);
    const email = body.email.trim().toLowerCase();
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (u) {
      const token = randomToken(32);
      await db.insert(passwordResetTokens).values({ userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) });
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") || `${req.nextUrl.origin}`;
      const link = `${base}/reset-password?token=${token}`;
      const sent = await sendEmail(email, "Reset your ScamLens password", `Use this link within one hour to reset your password:\n\n${link}\n\nIf you did not request this, ignore this email.`);
      if (!sent && process.env.NODE_ENV !== "production") console.log(`[dev] password reset link (email not configured): ${link}`);
    }
    return {
      data: {
        message: "If an account exists for that address, a reset link has been prepared.",
        emailDelivery: emailConfigured() ? "configured" : "not_configured",
      },
    };
  },
  { limits: { guest: 5, user: 5 }, windowSec: 900 },
);
