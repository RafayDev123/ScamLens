import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { ZodError, type ZodType } from "zod";
import { db } from "@/db";
import { apiKeys, usageEvents, users } from "@/db/schema";
import { GUEST_COOKIE, SESSION_COOKIE, cookieOptions, userFromToken, type SessionUser } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { clientIp, hit, ipHash } from "@/lib/security/ratelimit";
import { ScanInputError } from "@/lib/services/scan-service";
import type { Actor } from "@/lib/services/store";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export interface ApiCtx {
  req: NextRequest;
  requestId: string;
  actor: Actor;
  user: SessionUser | null;
  apiKeyId: string | null;
  ip: string;
  params: Record<string, string>;
}

interface RouteOptions {
  auth?: "optional" | "required" | "admin";
  /** Hourly limits; defaults suit read endpoints. Scan endpoints pass stricter ones. */
  limits?: { guest: number; user: number };
  windowSec?: number;
}

type Handler = (ctx: ApiCtx) => Promise<{ status?: number; data: unknown; headers?: Record<string, string> } | Response>;

export const SCAN_LIMITS = { guest: 10, user: 60 };

export async function readJson<T>(req: NextRequest, schema: ZodType<T>, maxBytes = 64_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ApiError(413, "payload_too_large", `Request body exceeds ${maxBytes} bytes.`);
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw new ApiError(415, "unsupported_media_type", "Content-Type must be application/json.");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "payload_too_large", `Request body exceeds ${maxBytes} bytes.`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  return schema.parse(json);
}

export function route(name: string, handler: Handler, opts: RouteOptions = {}) {
  return async (req: NextRequest, segment?: { params: Promise<Record<string, string>> }): Promise<Response> => {
    const started = Date.now();
    const requestId = `req_${randomToken(9)}`;
    const ip = clientIp(req.headers);
    let status = 500;
    let errorCode: string | null = null;
    let userId: string | null = null;
    let apiKeyId: string | null = null;
    let newGuest: string | null = null;
    let response: Response;
    const extraHeaders: Record<string, string> = { "x-request-id": requestId, "cache-control": "no-store" };
    try {
      const params = segment?.params ? await segment.params : {};
      // ---- identify caller
      let user: SessionUser | null = null;
      const authz = req.headers.get("authorization");
      const viaBearer = Boolean(authz?.startsWith("Bearer "));
      if (viaBearer) {
        const key = authz!.slice(7).trim();
        const [row] = await db.select({ id: apiKeys.id, userId: apiKeys.userId }).from(apiKeys).where(and(eq(apiKeys.keyHash, sha256(key)), isNull(apiKeys.revokedAt))).limit(1);
        if (!row) throw new ApiError(401, "invalid_api_key", "The API key is invalid or has been revoked.");
        apiKeyId = row.id;
        void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => undefined);
        const [u] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
        if (u) user = { id: u.id, email: u.email, displayName: u.displayName, role: u.role === "admin" ? "admin" : "user" };
      } else {
        user = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
      }
      // ---- CSRF: cookie-authenticated state changes must come from our own origin
      if (!viaBearer && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
        if (origin && host) {
          let originHost = "";
          try { originHost = new URL(origin).host; } catch { /* invalid origin */ }
          if (originHost !== host) throw new ApiError(403, "bad_origin", "Cross-site request rejected.");
        }
      }
      let actor: Actor;
      if (user) {
        userId = user.id;
        actor = { kind: "user", userId: user.id, role: user.role };
      } else {
        let gid = req.cookies.get(GUEST_COOKIE)?.value;
        if (!gid || !/^[a-f0-9]{32}$/.test(gid)) {
          gid = randomBytes(16).toString("hex");
          newGuest = gid;
        }
        actor = { kind: "guest", guestId: gid };
      }
      if (opts.auth === "required" && !user) throw new ApiError(401, "unauthenticated", "Sign in to use this endpoint.");
      if (opts.auth === "admin" && user?.role !== "admin") throw new ApiError(user ? 403 : 401, user ? "forbidden" : "unauthenticated", "Administrator access required.");
      // ---- rate limit
      const limits = opts.limits ?? { guest: 120, user: 600 };
      const rlKey = `${name}:${user ? `u:${user.id}` : `g:${ipHash(ip)}`}`;
      const rl = await hit(rlKey, user ? limits.user : limits.guest, opts.windowSec ?? 3600);
      Object.assign(extraHeaders, { "x-ratelimit-limit": String(rl.limit), "x-ratelimit-remaining": String(rl.remaining), "x-ratelimit-reset": String(Math.floor(rl.resetAt.getTime() / 1000)) });
      if (!rl.allowed) {
        extraHeaders["retry-after"] = String(Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)));
        throw new ApiError(429, "rate_limited", user ? "Rate limit reached. Please wait before sending more requests." : "Guest rate limit reached. Create a free account for higher limits.");
      }
      const result = await handler({ req, requestId, actor, user, apiKeyId, ip, params });
      if (result instanceof Response) {
        response = result;
        status = result.status;
        for (const [k, v] of Object.entries(extraHeaders)) response.headers.set(k, v);
      } else {
        status = result.status ?? 200;
        response = NextResponse.json({ data: result.data, meta: { requestId } }, { status, headers: { ...extraHeaders, ...(result.headers ?? {}) } });
      }
    } catch (e) {
      let body: { code: string; message: string; details?: unknown };
      if (e instanceof ApiError) {
        status = e.status;
        body = { code: e.code, message: e.message, details: e.details };
      } else if (e instanceof ZodError) {
        status = 400;
        body = { code: "validation_error", message: "The request is invalid.", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
      } else if (e instanceof ScanInputError) {
        status = 422;
        body = { code: e.code, message: e.message };
      } else {
        status = 500;
        body = { code: "internal_error", message: "An unexpected error occurred. Quote the request ID when contacting support." };
        console.error(`[${requestId}] ${name} failed:`, e instanceof Error ? e.message : "unknown");
      }
      errorCode = body.code;
      response = NextResponse.json({ error: { ...body, requestId } }, { status, headers: extraHeaders });
    }
    if (newGuest) {
      (response as NextResponse).cookies?.set?.(GUEST_COOKIE, newGuest, cookieOptions(86_400));
      if (!(response as NextResponse).cookies) response.headers.append("set-cookie", `${GUEST_COOKIE}=${newGuest}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`);
    }
    void db.insert(usageEvents).values({ userId, apiKeyId, route: name.slice(0, 80), method: req.method, status, errorCode, requestId, durationMs: Date.now() - started }).catch(() => undefined);
    return response;
  };
}
