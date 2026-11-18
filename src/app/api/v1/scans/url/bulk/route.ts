import { route, readJson } from "@/lib/api";
import { bulkUrlSchema } from "@/lib/schemas";
import { ScanInputError, scanUrl } from "@/lib/services/scan-service";
import { persistReport } from "@/lib/services/store";

export const runtime = "nodejs";

/** Bulk CSV analysis (client parses the CSV). Requires an account; strict hourly limit. */
export const POST = route(
  "POST /api/v1/scans/url/bulk",
  async ({ req, actor, apiKeyId }) => {
    const body = await readJson(req, bulkUrlSchema, 128_000);
    const unique = [...new Set(body.urls.map((u) => u.trim()).filter(Boolean))];
    const results: { input: string; reportId?: string; verdict?: string; verdictLabel?: string; riskSeverity?: number; error?: { code: string; message: string } }[] = [];
    // sequential with small concurrency to keep outbound load bounded
    for (let i = 0; i < unique.length; i += 3) {
      const slice = unique.slice(i, i + 3);
      const out = await Promise.all(
        slice.map(async (input) => {
          try {
            const r = await scanUrl(input, { shareWithProviders: body.shareWithProviders, inspectRedirects: body.inspectRedirects });
            const saved = await persistReport(r, actor, apiKeyId ? "api" : "web");
            return { input: r.subject, reportId: saved.id, verdict: r.verdict, verdictLabel: r.verdictLabel, riskSeverity: r.scores.severity };
          } catch (e) {
            if (e instanceof ScanInputError) return { input: input.slice(0, 80), error: { code: e.code, message: e.message } };
            return { input: input.slice(0, 80), error: { code: "scan_failed", message: "This URL could not be analyzed." } };
          }
        }),
      );
      results.push(...out);
    }
    return { status: 200, data: { count: results.length, results } };
  },
  { auth: "required", limits: { guest: 0, user: 5 } },
);
