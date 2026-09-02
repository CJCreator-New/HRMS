import { sanitizeForLog, maskEmail } from "./sanitize-log";

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
    } else if (k.toLowerCase() === "email" || k.toLowerCase().endsWith("_email")) {
      safe[k] = maskEmail(v);
    } else if (typeof v === "string") {
      safe[k] = sanitizeForLog(v);
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getActiveLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) return envLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getActiveLogLevel()];
}

export const logger = {
  debug(action: string, payload: StructuredLogPayload = {}) {
    if (!shouldLog("debug")) return;
    const entry = {
      level: "debug",
      timestamp: new Date().toISOString(),
      action: sanitizeForLog(action),
      ...payload,
      metadata: sanitizeMetadata(payload.metadata),
    };
    console.debug(JSON.stringify(entry));
  },

  info(action: string, payload: StructuredLogPayload = {}) {
    if (!shouldLog("info")) return;
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
    if (!shouldLog("warn")) return;
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
    if (!shouldLog("error")) return;
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
