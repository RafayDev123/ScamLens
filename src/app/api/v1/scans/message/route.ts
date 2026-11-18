import { route, readJson, SCAN_LIMITS } from "@/lib/api";
import { messageScanSchema } from "@/lib/schemas";
import { scanMessage } from "@/lib/services/scan-service";
import { persistReport } from "@/lib/services/store";

export const runtime = "nodejs";

export const POST = route(
  "POST /api/v1/scans/message",
  async ({ req, actor, apiKeyId }) => {
    const body = await readJson(req, messageScanSchema, 20_000);
    const report = await scanMessage(body.message);
    const saved = await persistReport(report, actor, apiKeyId ? "api" : "web");
    return { status: 201, data: { report: saved } };
  },
  { limits: SCAN_LIMITS },
);
