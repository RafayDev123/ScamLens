import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, readJson, route } from "@/lib/api";
import { db } from "@/db";
import { auditLogs, scans, userPreferences, users } from "@/db/schema";
import { destroySession } from "@/lib/auth";
import { verifyPassword } from "@/lib/security/crypto";
import { ipHash } from "@/lib/security/ratelimit";
import { accountPatchSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export const GET = route(
  "GET /api/account",
  async ({ user }) => {
    const [p] = await db.select().from(userPreferences).where(eq(userPreferences.userId, user!.id)).limit(1);
    return { data: { user, preferences: p ?? null } };
  },
  { auth: "required" },
);

export const PATCH = route(
  "PATCH /api/account",
  async ({ req, user }) => {
    const b = await readJson(req, accountPatchSchema);
    if (b.displayName !== undefined) await db.update(users).set({ displayName: b.displayName.trim() || null, updatedAt: new Date() }).where(eq(users.id, user!.id));
    const { displayName: _ignored, ...prefs } = b;
    void _ignored;
    if (Object.keys(prefs).length) {
      await db.insert(userPreferences).values({ userId: user!.id, ...prefs }).onConflictDoUpdate({ target: userPreferences.userId, set: { ...prefs, updatedAt: new Date() } });
    }
    const [p] = await db.select().from(userPreferences).where(eq(userPreferences.userId, user!.id)).limit(1);
    return { data: { preferences: p } };
  },
  { auth: "required" },
);

const deleteSchema = z.object({ scope: z.enum(["history", "account"]), password: z.string().max(200).optional() });

/** Delete all history, or the entire account (requires password). Fully cascades. */
export const DELETE = route(
  "DELETE /api/account",
  async ({ req, user, ip }) => {
    const b = await readJson(req, deleteSchema);
    if (b.scope === "history") {
      const del = await db.delete(scans).where(eq(scans.userId, user!.id)).returning({ id: scans.id });
      await db.insert(auditLogs).values({ userId: user!.id, action: "history.delete_all", detail: { count: del.length }, ipHash: ipHash(ip) });
      return { data: { deleted: del.length } };
    }
    const [u] = await db.select().from(users).where(and(eq(users.id, user!.id))).limit(1);
    if (!b.password || !u || !(await verifyPassword(b.password, u.passwordHash))) throw new ApiError(403, "invalid_credentials", "Password confirmation failed.");
    await db.insert(auditLogs).values({ userId: null, action: "account.delete", detail: {}, ipHash: ipHash(ip) });
    await db.delete(users).where(eq(users.id, user!.id));
    await destroySession();
    return { data: { deleted: true } };
  },
  { auth: "required" },
);
