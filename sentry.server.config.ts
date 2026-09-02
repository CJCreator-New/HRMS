// Sentry Server-side Configuration (P1-1)
// Initializes Sentry for Node.js App Router and Server Actions error monitoring

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

export function initServerSentry() {
  if (process.env.NODE_ENV !== "production" || !SENTRY_DSN) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs");
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  } catch {
    // Graceful fallback
  }
}
