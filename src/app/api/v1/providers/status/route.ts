import { db } from "@/db";
import { providerStatus } from "@/db/schema";
import { route } from "@/lib/api";
import { providerOverview } from "@/lib/providers";

export const runtime = "nodejs";

/** Honest provider availability. Never exposes keys – only whether they are configured. */
export const GET = route("GET /api/v1/providers/status", async () => {
  const rows = await db.select().from(providerStatus);
  const byId = new Map(rows.map((r) => [r.providerId, r]));
  return {
    data: {
      providers: providerOverview().map((p) => {
        const r = byId.get(p.id);
        return {
          id: p.id, name: p.name, kind: p.kind, configured: p.configured, state: p.configured ? "configured" : "configuration_required",
          sendsDataExternally: p.sendsDataExternally, requiresPaidPlan: p.requiresPaidPlan, requiredEnvVars: p.envVars, attribution: p.attribution,
          lastResult: r ? { status: r.lastStatus, detail: r.lastDetail, checkedAt: r.lastCheckedAt.toISOString() } : null,
        };
      }),
    },
  };
});
