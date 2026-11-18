import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, ilike, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { analysisSources, findings, reports, reportShareTokens, scans, threatMatches, userPreferences, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/security/crypto";
import type { Report, ScanType } from "@/lib/types";

export type Actor = { kind: "user"; userId: string; role: "user" | "admin" } | { kind: "guest"; guestId: string };

const GUEST_TTL_MS = 24 * 3600_000;
let lastPurge = 0;

/** Remove expired guest/unsaved records and records past their retention. Throttled. */
export async function purgeExpired(): Promise<void> {
  if (Date.now() - lastPurge < 10 * 60_000) return;
  lastPurge = Date.now();
  await db.delete(scans).where(and(lt(scans.expiresAt, new Date()))).catch(() => undefined);
}

function ownerFilter(actor: Actor) {
  return actor.kind === "user" ? eq(scans.userId, actor.userId) : and(eq(scans.guestId, actor.guestId), gt(scans.expiresAt, new Date()));
}

export async function persistReport(report: Report, actor: Actor, source: "web" | "api" = "web"): Promise<Report> {
  void purgeExpired();
  let saved = false;
  let expiresAt: Date = new Date(Date.now() + GUEST_TTL_MS);
  if (actor.kind === "user") {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, actor.userId)).limit(1);
    saved = prefs?.autoSaveHistory ?? true;
    if (saved) expiresAt = new Date(Date.now() + (prefs?.retentionDays ?? 90) * 86_400_000);
  }
  const id = randomUUID();
  const document: Report = { ...report, id };
  await db.transaction(async (tx) => {
    await tx.insert(scans).values({
      id,
      userId: actor.kind === "user" ? actor.userId : null,
      guestId: actor.kind === "guest" ? actor.guestId : null,
      type: report.type,
      subjectDisplay: report.subject.slice(0, 600),
      subjectHash: sha256(`${report.type}:${report.subject}`),
      verdict: report.verdict,
      riskScore: report.scores.severity,
      confidence: report.scores.confidence,
      coveragePct: report.scores.coveragePct,
      findingCount: report.findings.length,
      saved,
      source,
      expiresAt,
    });
    if (report.findings.length) {
      await tx.insert(findings).values(report.findings.map((f) => ({ scanId: id, code: f.code.slice(0, 64), title: f.title, severity: f.severity, confidence: f.confidence, source: f.source.slice(0, 48) })));
    }
    if (report.threatMatches.length) {
      await tx.insert(threatMatches).values(report.threatMatches.map((m) => ({ scanId: id, provider: m.provider.slice(0, 48), threatType: m.threatType.slice(0, 64), metadata: m.metadata ?? {} })));
    }
    if (report.sources.length) {
      await tx.insert(analysisSources).values(report.sources.map((s) => ({ scanId: id, sourceId: s.id.slice(0, 48), status: s.status, detail: s.detail, checkedAt: new Date(s.checkedAt) })));
    }
    await tx.insert(reports).values({ id, scanId: id, userId: actor.kind === "user" ? actor.userId : null, guestId: actor.kind === "guest" ? actor.guestId : null, document });
  });
  return document;
}

export interface StoredReport {
  report: Report;
  saved: boolean;
  expiresAt: string | null;
  shared: { active: boolean; expiresAt: string | null };
}

export async function getReport(id: string, actor: Actor): Promise<StoredReport | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ document: reports.document, saved: scans.saved, expiresAt: scans.expiresAt })
    .from(reports)
    .innerJoin(scans, eq(scans.id, reports.scanId))
    .where(and(eq(reports.id, id), ownerFilter(actor)))
    .limit(1);
  if (!row) return null;
  const [share] = await db
    .select({ expiresAt: reportShareTokens.expiresAt })
    .from(reportShareTokens)
    .where(and(eq(reportShareTokens.reportId, id), isNull(reportShareTokens.revokedAt), gt(reportShareTokens.expiresAt, new Date())))
    .orderBy(desc(reportShareTokens.expiresAt))
    .limit(1);
  return { report: row.document as Report, saved: row.saved, expiresAt: row.expiresAt?.toISOString() ?? null, shared: { active: Boolean(share), expiresAt: share?.expiresAt.toISOString() ?? null } };
}

export interface ScanRow {
  id: string;
  type: string;
  subject: string;
  verdict: string;
  riskScore: number;
  confidence: string;
  findingCount: number;
  saved: boolean;
  createdAt: string;
}

export async function listScans(actor: Actor, opts: { page: number; pageSize: number; type?: ScanType; q?: string; savedOnly?: boolean }): Promise<{ items: ScanRow[]; total: number }> {
  const conds = [ownerFilter(actor)];
  if (opts.type) conds.push(eq(scans.type, opts.type));
  if (opts.savedOnly) conds.push(eq(scans.saved, true));
  if (opts.q) {
    const like = `%${opts.q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(scans.subjectDisplay, like), ilike(scans.verdict, like))!);
  }
  const where = and(...conds);
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(scans).where(where).orderBy(desc(scans.createdAt)).limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(scans).where(where),
  ]);
  return {
    total: Number(total),
    items: rows.map((r) => ({ id: r.id, type: r.type, subject: r.subjectDisplay, verdict: r.verdict, riskScore: r.riskScore, confidence: r.confidence, findingCount: r.findingCount, saved: r.saved, createdAt: r.createdAt.toISOString() })),
  };
}

export async function deleteScan(id: string, actor: Actor): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const res = await db.delete(scans).where(and(eq(scans.id, id), ownerFilter(actor))).returning({ id: scans.id });
  return res.length > 0;
}

/** Save to history (also claims a guest report for the signed-in user). */
export async function saveReport(id: string, userId: string, guestId: string | null): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  const expiresAt = new Date(Date.now() + (prefs?.retentionDays ?? 90) * 86_400_000);
  const owner = guestId ? or(eq(scans.userId, userId), and(eq(scans.guestId, guestId), gt(scans.expiresAt, new Date()))) : eq(scans.userId, userId);
  const res = await db.update(scans).set({ userId, guestId: null, saved: true, expiresAt }).where(and(eq(scans.id, id), owner)).returning({ id: scans.id });
  if (!res.length) return false;
  await db.update(reports).set({ userId, guestId: null }).where(eq(reports.id, id));
  return true;
}

export async function createShare(id: string, actor: Actor, ttlDays = 7): Promise<{ token: string; expiresAt: Date } | null> {
  const owned = await getReport(id, actor);
  if (!owned) return null;
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.insert(reportShareTokens).values({ reportId: id, tokenHash: sha256(token), expiresAt });
  return { token, expiresAt };
}

export async function revokeShares(id: string, actor: Actor): Promise<number> {
  const owned = await getReport(id, actor);
  if (!owned) return -1;
  const res = await db.update(reportShareTokens).set({ revokedAt: new Date() }).where(and(eq(reportShareTokens.reportId, id), isNull(reportShareTokens.revokedAt))).returning({ id: reportShareTokens.id });
  return res.length;
}

export async function getSharedReport(token: string): Promise<Report | null> {
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null;
  const [row] = await db
    .select({ document: reports.document })
    .from(reportShareTokens)
    .innerJoin(reports, eq(reports.id, reportShareTokens.reportId))
    .where(and(eq(reportShareTokens.tokenHash, sha256(token)), isNull(reportShareTokens.revokedAt), gt(reportShareTokens.expiresAt, new Date())))
    .limit(1);
  return row ? (row.document as Report) : null;
}

export async function exportAllForUser(userId: string) {
  const [u] = await db.select({ id: users.id, email: users.email, displayName: users.displayName, createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
  const rows = await db.select({ id: reports.id, createdAt: reports.createdAt, document: reports.document }).from(reports).where(eq(reports.userId, userId)).orderBy(desc(reports.createdAt));
  return { exportedAt: new Date().toISOString(), account: u, reports: rows.map((r) => r.document) };
}

export async function dashboardStats(userId: string) {
  const byType = await db.select({ type: scans.type, n: count() }).from(scans).where(eq(scans.userId, userId)).groupBy(scans.type);
  const byVerdict = await db.select({ verdict: scans.verdict, n: count() }).from(scans).where(eq(scans.userId, userId)).groupBy(scans.verdict);
  const recent = await listScans({ kind: "user", userId, role: "user" }, { page: 1, pageSize: 6 });
  const total = byType.reduce((s, r) => s + Number(r.n), 0);
  const flagged = byVerdict.filter((v) => ["likely_malicious", "high_risk", "suspicious"].includes(v.verdict)).reduce((s, r) => s + Number(r.n), 0);
  return { total, flagged, byType: byType.map((r) => ({ type: r.type, n: Number(r.n) })), byVerdict: byVerdict.map((r) => ({ verdict: r.verdict, n: Number(r.n) })), recent: recent.items };
}

export async function adminStats() {
  const [{ users: userCount }] = await db.select({ users: count() }).from(users);
  const [{ scanCount }] = await db.select({ scanCount: count() }).from(scans);
  const byType = await db.select({ type: scans.type, n: count() }).from(scans).groupBy(scans.type);
  const usage = await db.execute(sql`select count(*)::int as total, count(*) filter (where status >= 500)::int as errors5xx, count(*) filter (where status = 429)::int as limited, count(*) filter (where api_key_id is not null)::int as api_calls from usage_events where created_at > now() - interval '24 hours'`);
  const errors = await db.execute(sql`select error_code, count(*)::int as n from usage_events where error_code is not null and created_at > now() - interval '24 hours' group by error_code order by n desc limit 10`);
  const providers = await db.execute(sql`select provider_id, last_status, last_detail, last_checked_at, success_count, failure_count from provider_status order by provider_id`);
  const audit = await db.execute(sql`select a.action, a.created_at, a.ip_hash, u.email from audit_logs a left join users u on u.id = a.user_id order by a.created_at desc limit 25`);
  return { users: Number(userCount), scans: Number(scanCount), byType: byType.map((r) => ({ type: r.type, n: Number(r.n) })), usage: usage.rows[0] as Record<string, number>, errors: errors.rows as { error_code: string; n: number }[], providers: providers.rows as Record<string, unknown>[], audit: audit.rows as Record<string, unknown>[] };
}
