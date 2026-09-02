/**
 * Centralized Error Tracking & Sentry Telemetry Integration (P1-1).
 *
 * Configured to capture client and server exceptions, tagging errors with
 * `userRole`, `employeeId`, `module`, and transaction metadata.
 */

export interface ErrorContext {
  userRole?: string;
  employeeId?: string;
  module?: string;
  action?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Captures an application exception and forwards it to Sentry if configured,
 * or formats structured diagnostic error logs in non-production.
 */
export function captureException(error: unknown, context: ErrorContext = {}): void {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  const isProduction = process.env.NODE_ENV === "production";
  const errorObj = error instanceof Error ? error : new Error(String(error));

  if (isProduction && dsn) {
    try {
      // Dynamic require avoids bundling issues if @sentry/nextjs is optional
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/nextjs");
      Sentry.withScope((scope: any) => {
        if (context.userRole) scope.setTag("userRole", context.userRole);
        if (context.employeeId) scope.setUser({ id: context.employeeId });
        if (context.module) scope.setTag("module", context.module);
        if (context.action) scope.setTag("action", context.action);
        if (context.tags) {
          Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
        }
        if (context.extra) {
          Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
        }
        Sentry.captureException(errorObj);
      });
      return;
    } catch {
      // Sentry SDK not loaded; fallback to standard logger
    }
  }

  if (!isProduction) {
    console.error("[Sentry Telemetry Fallback]", {
      message: errorObj.message,
      stack: errorObj.stack,
      context,
    });
  }
}
