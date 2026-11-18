import { route, readJson, SCAN_LIMITS } from "@/lib/api";
import { domainScanSchema } from "@/lib/schemas";
import { scanDomain } from "@/lib/services/scan-service";
import { persistReport } from "@/lib/services/store";

export const runtime = "nodejs";
export const maxDuration = 45;

export const POST = route(
  "POST /api/v1/scans/domain",
  async ({ req, actor, apiKeyId }) => {
    const body = await readJson(req, domainScanSchema);
    const report = await scanDomain(body.domain, { shareWithProviders: body.shareWithProviders });
    const saved = await persistReport(report, actor, apiKeyId ? "api" : "web");
    return { status: 201, data: { report: saved } };
  },
  { limits: SCAN_LIMITS },
);
