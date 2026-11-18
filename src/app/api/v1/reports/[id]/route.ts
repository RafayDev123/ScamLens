import { ApiError, readJson, route } from "@/lib/api";
import { GUEST_COOKIE } from "@/lib/auth";
import { saveSchema } from "@/lib/schemas";
import { getReport, saveReport } from "@/lib/services/store";

export const runtime = "nodejs";

export const GET = route("GET /api/v1/reports/:id", async ({ actor, params }) => {
  const found = await getReport(params.id, actor);
  if (!found) throw new ApiError(404, "not_found", "Report not found.");
  return { data: found };
});

/** Save to account history (signed-in users; also claims a guest report). */
export const PATCH = route(
  "PATCH /api/v1/reports/:id",
  async ({ req, actor, user, params }) => {
    await readJson(req, saveSchema);
    if (!user) throw new ApiError(401, "unauthenticated", "Sign in to save reports to your history.");
    void actor;
    const guest = req.cookies.get(GUEST_COOKIE)?.value;
    const ok = await saveReport(params.id, user.id, guest && /^[a-f0-9]{32}$/.test(guest) ? guest : null);
    if (!ok) throw new ApiError(404, "not_found", "Report not found.");
    const found = await getReport(params.id, { kind: "user", userId: user.id, role: user.role });
    return { data: found };
  },
);
