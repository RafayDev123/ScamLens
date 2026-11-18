import { route } from "@/lib/api";
import { exportAllForUser } from "@/lib/services/store";

export const runtime = "nodejs";

export const GET = route(
  "GET /api/account/export",
  async ({ user }) => {
    const data = await exportAllForUser(user!.id);
    return new Response(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="scamlens-export.json"' } });
  },
  { auth: "required" },
);
