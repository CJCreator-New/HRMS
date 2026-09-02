// Sentry Client-side Configuration (P1-1)
// Initializes Sentry for browser error monitoring with environment tagging

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

export function initClientSentry() {
  if (process.env.NODE_ENV !== "production" || !SENTRY_DSN) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs");
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      environment: process.env.NODE_ENV,
    });
  } catch {
    // Graceful fallback
  }
}
