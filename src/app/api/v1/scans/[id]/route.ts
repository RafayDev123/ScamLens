import { ApiError, route } from "@/lib/api";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { ipHash } from "@/lib/security/ratelimit";
import { deleteScan, getReport } from "@/lib/services/store";

export const runtime = "nodejs";

export const GET = route("GET /api/v1/scans/:id", async ({ actor, params }) => {
  const found = await getReport(params.id, actor);
  if (!found) throw new ApiError(404, "not_found", "Scan not found.");
  return { data: { id: params.id, saved: found.saved, expiresAt: found.expiresAt, report: found.report } };
});

export const DELETE = route("DELETE /api/v1/scans/:id", async ({ actor, params, user, ip }) => {
  const ok = await deleteScan(params.id, actor);
  if (!ok) throw new ApiError(404, "not_found", "Scan not found.");
  if (user) await db.insert(auditLogs).values({ userId: user.id, action: "scan.delete", detail: { scanId: params.id }, ipHash: ipHash(ip) }).catch(() => undefined);
  return { data: { deleted: true } };
});
