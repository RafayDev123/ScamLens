import { and, desc, eq, isNull } from "drizzle-orm";
import { ApiError, readJson, route } from "@/lib/api";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { apiKeyCreateSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export const GET = route(
  "GET /api/account/api-keys",
  async ({ user }) => {
    const rows = await db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys).where(and(eq(apiKeys.userId, user!.id), isNull(apiKeys.revokedAt))).orderBy(desc(apiKeys.createdAt));
    return { data: { keys: rows } };
  },
  { auth: "required" },
);

/** The full key is returned exactly once; only its SHA-256 hash is stored. */
export const POST = route(
  "POST /api/account/api-keys",
  async ({ req, user }) => {
    const b = await readJson(req, apiKeyCreateSchema);
    const active = await db.select({ id: apiKeys.id }).from(apiKeys).where(and(eq(apiKeys.userId, user!.id), isNull(apiKeys.revokedAt)));
    if (active.length >= 5) throw new ApiError(422, "key_limit", "You can have at most 5 active API keys.");
    const key = `sl_live_${randomToken(24)}`;
    const [row] = await db.insert(apiKeys).values({ userId: user!.id, name: b.name.trim(), prefix: key.slice(0, 12), keyHash: sha256(key) }).returning({ id: apiKeys.id });
    return { status: 201, data: { id: row.id, key, note: "Store this key now – it cannot be shown again." } };
  },
  { auth: "required", limits: { guest: 5, user: 20 } },
);

export const DELETE = route(
  "DELETE /api/account/api-keys",
  async ({ req, user }) => {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(400, "validation_error", "Invalid key id.");
    const res = await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user!.id), isNull(apiKeys.revokedAt))).returning({ id: apiKeys.id });
    if (!res.length) throw new ApiError(404, "not_found", "API key not found.");
    return { data: { revoked: true } };
  },
  { auth: "required" },
);
