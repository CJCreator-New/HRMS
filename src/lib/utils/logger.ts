import { sanitizeForLog } from "./sanitize-log";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface StructuredLogPayload {
  level?: LogLevel;
  timestamp?: string;
  requestId?: string;
  correlationId?: string;
  actorId?: string | null;
  action?: string;
  entity?: string;
  entityId?: string | null;
  message?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Sanitizes metadata to prevent logging sensitive secrets, passwords, or tokens.
 */
function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const safe: Record<string, unknown> = {};
  const REDACTED_KEYS = new Set([
    "password",
    "temppassword",
    "token",
    "secret",
    "access_token",
    "cookie",
    "authorization",
    "salary",
    "ctc",
    "monthly_ctc",
    "annual_ctc",
    "gross",
    "net_pay",
    "pan",
    "pan_number",
    "aadhaar",
    "aadhaar_number",
    "bank_account",
    "account_number",
    "ifsc",
    "uan",
    "uan_number",
  ]);

  for (const [k, v] of Object.entries(meta)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      safe[k] = "[REDACTED]";
    } else if (typeof v === "string") {
      safe[k] = sanitizeForLog(v);
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

export const logger = {
  info(action: string, payload: StructuredLogPayload = {}) {
    const entry = {
      level: "info",
      timestamp: new Date().toISOString(),
      action: sanitizeForLog(action),
      ...payload,
      metadata: sanitizeMetadata(payload.metadata),
    };
    console.info(JSON.stringify(entry));
  },

  warn(action: string, payload: StructuredLogPayload = {}) {
    const entry = {
      level: "warn",
      timestamp: new Date().toISOString(),
      action: sanitizeForLog(action),
      ...payload,
      metadata: sanitizeMetadata(payload.metadata),
    };
    console.warn(JSON.stringify(entry));
  },

  error(action: string, payload: StructuredLogPayload = {}) {
    const entry = {
      level: "error",
      timestamp: new Date().toISOString(),
      action: sanitizeForLog(action),
      ...payload,
      metadata: sanitizeMetadata(payload.metadata),
    };
    console.error(JSON.stringify(entry));
  },
};
