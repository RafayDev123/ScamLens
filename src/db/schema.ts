import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** Accounts (profiles). Passwords are scrypt hashes; never plain text. */
export const users = pgTable(
  "users",
  {
    id: id(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 80 }),
    role: varchar("role", { length: 16 }).notNull().default("user"), // user | admin
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("prt_token_uq").on(t.tokenHash)],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  theme: varchar("theme", { length: 8 }).notNull().default("dark"),
  autoSaveHistory: boolean("auto_save_history").notNull().default(true),
  retentionDays: integer("retention_days").notNull().default(90),
  notifyProductUpdates: boolean("notify_product_updates").notNull().default(false),
  notifySecurityAlerts: boolean("notify_security_alerts").notNull().default(true),
  updatedAt: updatedAt(),
});

/**
 * One row per analysis. Owner is either a user or an anonymous guest (cookie id).
 * `subject_display` is ALWAYS the redacted subject (query values masked / message text truncated).
 */
export const scans = pgTable(
  "scans",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestId: varchar("guest_id", { length: 64 }),
    type: varchar("type", { length: 16 }).notNull(), // url | message | qr | domain | email-header
    subjectDisplay: text("subject_display").notNull(),
    subjectHash: varchar("subject_hash", { length: 64 }).notNull(),
    verdict: varchar("verdict", { length: 32 }).notNull(),
    riskScore: integer("risk_score").notNull(),
    confidence: varchar("confidence", { length: 8 }).notNull(),
    coveragePct: integer("coverage_pct").notNull(),
    findingCount: integer("finding_count").notNull().default(0),
    saved: boolean("saved").notNull().default(true),
    source: varchar("source", { length: 8 }).notNull().default("web"), // web | api
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("scans_user_created_idx").on(t.userId, t.createdAt),
    index("scans_guest_idx").on(t.guestId),
    index("scans_type_idx").on(t.type),
    index("scans_expires_idx").on(t.expiresAt),
  ],
);

export const findings = pgTable(
  "findings",
  {
    id: id(),
    scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    title: text("title").notNull(),
    severity: varchar("severity", { length: 12 }).notNull(),
    confidence: varchar("confidence", { length: 8 }).notNull(),
    source: varchar("source", { length: 48 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("findings_scan_idx").on(t.scanId)],
);

export const threatMatches = pgTable(
  "threat_matches",
  {
    id: id(),
    scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 48 }).notNull(),
    threatType: varchar("threat_type", { length: 64 }).notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("tm_scan_idx").on(t.scanId)],
);

export const analysisSources = pgTable(
  "analysis_sources",
  {
    id: id(),
    scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    sourceId: varchar("source_id", { length: 48 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(), // ok | unavailable | not_configured | error | skipped
    detail: text("detail"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("as_scan_idx").on(t.scanId)],
);

/** Frozen report snapshot (JSONB) for a scan. Private by default. */
export const reports = pgTable(
  "reports",
  {
    id: id(),
    scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestId: varchar("guest_id", { length: 64 }),
    document: jsonb("document").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reports_scan_uq").on(t.scanId), index("reports_user_idx").on(t.userId)],
);

export const reportShareTokens = pgTable(
  "report_share_tokens",
  {
    id: id(),
    reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("rst_token_uq").on(t.tokenHash), index("rst_report_idx").on(t.reportId)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    prefix: varchar("prefix", { length: 12 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("api_keys_hash_uq").on(t.keyHash), index("api_keys_user_idx").on(t.userId)],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    route: varchar("route", { length: 80 }).notNull(),
    method: varchar("method", { length: 8 }).notNull(),
    status: integer("status").notNull(),
    errorCode: varchar("error_code", { length: 40 }),
    requestId: varchar("request_id", { length: 40 }),
    durationMs: integer("duration_ms"),
    createdAt: createdAt(),
  },
  (t) => [index("usage_created_idx").on(t.createdAt), index("usage_user_idx").on(t.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    detail: jsonb("detail").notNull().default({}),
    ipHash: varchar("ip_hash", { length: 16 }),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const providerStatus = pgTable("provider_status", {
  providerId: varchar("provider_id", { length: 48 }).primaryKey(),
  lastStatus: varchar("last_status", { length: 16 }).notNull(),
  lastDetail: text("last_detail"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
});

export const rateLimitRecords = pgTable(
  "rate_limit_records",
  {
    key: varchar("key", { length: 120 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("rl_key_window_uq").on(t.key, t.windowStart)],
);
