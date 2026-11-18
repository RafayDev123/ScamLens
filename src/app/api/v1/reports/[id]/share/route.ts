import { ApiError, route } from "@/lib/api";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { ipHash } from "@/lib/security/ratelimit";
import { createShare, revokeShares } from "@/lib/services/store";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host}`;
}

/** Create a private, unguessable, time-limited share link (7 days). Only the SHA-256 of the token is stored. */
export const POST = route(
  "POST /api/v1/reports/:id/share",
  async ({ req, actor, params, user, ip }) => {
    if (!user) throw new ApiError(401, "unauthenticated", "Sign in to create share links.");
    const share = await createShare(params.id, actor, 7);
    if (!share) throw new ApiError(404, "not_found", "Report not found.");
    await db.insert(auditLogs).values({ userId: user.id, action: "report.share.create", detail: { reportId: params.id }, ipHash: ipHash(ip) }).catch(() => undefined);
    return { status: 201, data: { url: `${baseUrl(req)}/shared/${share.token}`, expiresAt: share.expiresAt.toISOString() } };
  },
  { limits: { guest: 5, user: 60 } },
);

export const DELETE = route("DELETE /api/v1/reports/:id/share", async ({ actor, params, user, ip }) => {
  const n = await revokeShares(params.id, actor);
  if (n < 0) throw new ApiError(404, "not_found", "Report not found.");
  if (user) await db.insert(auditLogs).values({ userId: user.id, action: "report.share.revoke", detail: { reportId: params.id, revoked: n }, ipHash: ipHash(ip) }).catch(() => undefined);
  return { data: { revoked: n } };
});
