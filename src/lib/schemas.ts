import { z } from "zod";
import { SCAN_TYPES } from "@/lib/types";

export const urlScanSchema = z.object({
  url: z.string().min(1, "url is required").max(2048),
  shareWithProviders: z.boolean().default(false),
  inspectRedirects: z.boolean().default(false),
});
export const bulkUrlSchema = z.object({
  urls: z.array(z.string().min(1).max(2048)).min(1).max(25),
  shareWithProviders: z.boolean().default(false),
  inspectRedirects: z.boolean().default(false),
});
export const messageScanSchema = z.object({ message: z.string().min(1, "message is required").max(5000) });
export const qrScanSchema = z.object({
  content: z.string().min(1, "content is required").max(4000),
  shareWithProviders: z.boolean().default(false),
  inspectRedirects: z.boolean().default(false),
});
export const domainScanSchema = z.object({ domain: z.string().min(1, "domain is required").max(300), shareWithProviders: z.boolean().default(false) });
export const emailHeaderSchema = z.object({ headers: z.string().min(1, "headers is required").max(30000) });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(SCAN_TYPES as [string, ...string[]]).optional(),
  q: z.string().max(100).optional(),
});
export const exportSchema = z.object({ format: z.enum(["json", "pdf"]).default("json") });
export const shareSchema = z.object({ ttlDays: z.number().int().min(1).max(30).default(7) }).default({ ttlDays: 7 });
export const saveSchema = z.object({ saved: z.literal(true) });

export const registerSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200), displayName: z.string().max(80).optional() });
export const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });
export const forgotSchema = z.object({ email: z.string().email().max(254) });
export const resetSchema = z.object({ token: z.string().min(20).max(100), password: z.string().min(1).max(200) });
export const accountPatchSchema = z.object({
  displayName: z.string().max(80).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  autoSaveHistory: z.boolean().optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  notifyProductUpdates: z.boolean().optional(),
  notifySecurityAlerts: z.boolean().optional(),
});
export const apiKeyCreateSchema = z.object({ name: z.string().min(1).max(60) });
