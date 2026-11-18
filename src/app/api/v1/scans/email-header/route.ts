import { route, readJson, SCAN_LIMITS } from "@/lib/api";
import { emailHeaderSchema } from "@/lib/schemas";
import { scanEmailHeaders } from "@/lib/services/scan-service";
import { persistReport } from "@/lib/services/store";

export const runtime = "nodejs";

export const POST = route(
  "POST /api/v1/scans/email-header",
  async ({ req, actor, apiKeyId }) => {
    const body = await readJson(req, emailHeaderSchema, 40_000);
    const report = await scanEmailHeaders(body.headers);
    const saved = await persistReport(report, actor, apiKeyId ? "api" : "web");
    return { status: 201, data: { report: saved } };
  },
  { limits: SCAN_LIMITS },
);
