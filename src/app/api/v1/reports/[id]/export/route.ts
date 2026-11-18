import { ApiError, readJson, route } from "@/lib/api";
import { reportToPdf } from "@/lib/report-pdf";
import { exportSchema } from "@/lib/schemas";
import { getReport } from "@/lib/services/store";

export const runtime = "nodejs";

export const POST = route("POST /api/v1/reports/:id/export", async ({ req, actor, params }) => {
  const { format } = await readJson(req, exportSchema);
  const found = await getReport(params.id, actor);
  if (!found) throw new ApiError(404, "not_found", "Report not found.");
  const name = `scamlens-report-${params.id.slice(0, 8)}`;
  if (format === "pdf") {
    const bytes = await reportToPdf(found.report);
    return new Response(Buffer.from(bytes), { status: 200, headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}.pdf"` } });
  }
  return new Response(JSON.stringify(found.report, null, 2), { status: 200, headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${name}.json"` } });
});
