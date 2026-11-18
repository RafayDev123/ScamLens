import { and, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitRecords } from "@/db/schema";
import { sha256 } from "./crypto";

export interface LimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/** Fixed-window, database-backed limiter (works across multiple app instances). */
export async function hit(key: string, limit: number, windowSec: number): Promise<LimitResult> {
  const size = windowSec * 1000;
  const start = Math.floor(Date.now() / size) * size;
  const windowStart = new Date(start);
  const [row] = await db
    .insert(rateLimitRecords)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitRecords.key, rateLimitRecords.windowStart],
      set: { count: sql`${rateLimitRecords.count} + 1` },
    })
    .returning({ count: rateLimitRecords.count });
  if (Math.random() < 0.01) {
    await db
      .delete(rateLimitRecords)
      .where(and(lt(rateLimitRecords.windowStart, new Date(Date.now() - 86_400_000))))
      .catch(() => undefined);
  }
  return { allowed: row.count <= limit, limit, remaining: Math.max(0, limit - row.count), resetAt: new Date(start + size) };
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown").slice(0, 64);
}

/** Short irreversible IP fingerprint for rate-limit keys and audit logs (no raw IPs stored). */
export function ipHash(ip: string): string {
  return sha256(`scamlens-ip:${ip}`).slice(0, 16);
}
