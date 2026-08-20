"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Real-user performance reporting (budget harness — signal side).
 *
 * Feeds `useReportWebVitals` (built into Next, no extra deps) so Core Web
 * Vitals from real sessions surface in the console (dev) and are kept on
 * `window.__HRMS_WEB_VITALS__` for inspection/debugging. The CI *gate* side
 * of the budget harness lives in `e2e/specs/nfr/performance.spec.ts`.
 *
 * Per Next docs, the hook must live in a `"use client"` component imported by
 * the root layout — this confines the client boundary to this tiny file.
 *
 * Budgets (see docs/SPEC or the perf spec):
 *  - LCP < 2.5s, CLS < 0.1, INP < 200ms
 *  - first-load JS < 180 KB gzip per route
 *  - server-action round-trip < 300 ms p95
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      console.info(`[web-vitals] ${metric.name}: ${Math.round(metric.value)} (${metric.rating})`);
    }
    if (typeof window !== "undefined") {
      const existing = (window as any).__HRMS_WEB_VITALS__ ?? {};
      (window as any).__HRMS_WEB_VITALS__ = { ...existing, [metric.name]: metric };
    }
  });
  return null;
}

export default WebVitals;
