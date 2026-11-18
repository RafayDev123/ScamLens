import { route } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = route("POST /api/auth/logout", async () => {
  await destroySession();
  return { data: { signedOut: true } };
});
