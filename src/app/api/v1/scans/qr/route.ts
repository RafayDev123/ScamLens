import { route, readJson, SCAN_LIMITS } from "@/lib/api";
import { qrScanSchema } from "@/lib/schemas";
import { scanQr } from "@/lib/services/scan-service";
import { persistReport } from "@/lib/services/store";

export const runtime = "nodejs";

/** Accepts DECODED QR text only. Images are decoded in the browser and never uploaded. */
export const POST = route(
  "POST /api/v1/scans/qr",
  async ({ req, actor, apiKeyId }) => {
    const body = await readJson(req, qrScanSchema, 20_000);
    const report = await scanQr(body.content, { shareWithProviders: body.shareWithProviders, inspectRedirects: body.inspectRedirects });
    const saved = await persistReport(report, actor, apiKeyId ? "api" : "web");
    return { status: 201, data: { report: saved } };
  },
  { limits: SCAN_LIMITS },
);
