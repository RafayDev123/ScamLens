import { route } from "@/lib/api";
import { listQuerySchema } from "@/lib/schemas";
import { listScans } from "@/lib/services/store";
import type { ScanType } from "@/lib/types";

export const runtime = "nodejs";

export const GET = route("GET /api/v1/scans", async ({ req, actor }) => {
  const q = listQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await listScans(actor, { page: q.page, pageSize: q.pageSize, type: q.type as ScanType | undefined, q: q.q });
  return { data: { items, pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) } } };
});
