import { route, readJson, SCAN_LIMITS } from "@/lib/api";
import { urlScanSchema } from "@/lib/schemas";
import { scanUrl } from "@/lib/services/scan-service";
import { persistReport } from "@/lib/services/store";

export const runtime = "nodejs";

export const POST = route(
  "POST /api/v1/scans/url",
  async ({ req, actor, apiKeyId }) => {
    const body = await readJson(req, urlScanSchema);
    const report = await scanUrl(body.url, { shareWithProviders: body.shareWithProviders, inspectRedirects: body.inspectRedirects });
    const saved = await persistReport(report, actor, apiKeyId ? "api" : "web");
    return { status: 201, data: { report: saved } };
  },
  { limits: SCAN_LIMITS },
);
