import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/auth.fixture";

/**
 * P3 Non-Functional Requirements: Performance Budgets
 *
 * These are the *gate* side of the budget harness (the signal side is
 * `src/components/shared/WebVitals.tsx` via useReportWebVitals).
 *
 * Agreed budgets (per shortlist page):
 *   - LCP            < 2.5s
 *   - CLS            < 0.1   (guarded by web-vitals reporting; LCP asserted here)
 *   - INP            < 200ms (guarded by web-vitals reporting in real sessions)
 *   - first-load JS  < 180 KB gzip per route   (sum of JS transferSize)
 *   - server action  < 300 ms p95              (not asserted here; measured on seeded data)
 *
 * Requirements to run: a seeded DB + `next start` production build (the
 * Playwright webServer starts `npx next start`). Not part of the PR-gating
 * `e2e:p0` suite — run deliberately via `npm run test:e2e:nfr`.
 *
 * NOTE: routes are measured *authenticated* because that is how the app is
 * used; the RSC conversion work (slice-by-slice) is what moves these green.
 */

const LCP_BUDGET_MS = 2500;
/** First-load JS budget in bytes (180 KB wire/compressed). */
const JS_BUDGET_BYTES = 180 * 1024;

/** Registers an LCP observer before the next navigation and returns the value. */
async function collectLcp(page: Page): Promise<number> {
  await page.addInitScript(() => {
    (window as any).__hrmsLcp = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) (window as any).__hrmsLcp = last.startTime;
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      /* PerformanceObserver unavailable — leave 0 */
    }
  });
  return 0;
}

/** Sum of compressed JS bytes downloaded for the current document. */
async function firstLoadJsBytes(page: Page): Promise<number> {
  return page.evaluate(() => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return resources
      .filter((r) => r.name.endsWith(".js"))
      .reduce((sum, r) => sum + (r.transferSize || 0), 0);
  });
}

/** Navigates to an authenticated route and waits for it to settle. */
async function gotoAuth(page: Page, path: string, settleSelector: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("load");
  await expect(page.locator(settleSelector).first()).toBeVisible({ timeout: 10000 });
  // Allow late paints / deferred effects to settle before reading metrics.
  await page.waitForTimeout(300);
}

test.describe("P3 Non-Functional Requirements: Performance Budgets", () => {
  test("PERF-01: Login page LCP within budget (public, unauthenticated)", async ({ page, baseURL }) => {
    await collectLcp(page);
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState("load");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(300);

    const lcp = await page.evaluate(() => (window as any).__hrmsLcp ?? 0);
    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(5000); // login not on the shortlist; generous ceiling
  });

  test("PERF-02: Dashboard (/) — LCP and first-load JS within budget", async ({ employeePage }) => {
    await collectLcp(employeePage);
    await gotoAuth(employeePage, "/", '[data-testid="dashboard-greeting"]');

    const lcp = await employeePage.evaluate(() => (window as any).__hrmsLcp ?? 0);
    const jsBytes = await firstLoadJsBytes(employeePage);

    expect(lcp, `dashboard LCP ${lcp.toFixed(0)}ms`).toBeLessThan(LCP_BUDGET_MS);
    expect(jsBytes, `dashboard first-load JS ${(jsBytes / 1024).toFixed(0)}KB`).toBeLessThan(JS_BUDGET_BYTES);
  });

  test("PERF-03: Attendance (self) — LCP within budget", async ({ employeePage }) => {
    await collectLcp(employeePage);
    await gotoAuth(employeePage, "/attendance", "main");

    const lcp = await employeePage.evaluate(() => (window as any).__hrmsLcp ?? 0);
    expect(lcp, `attendance LCP ${lcp.toFixed(0)}ms`).toBeLessThan(LCP_BUDGET_MS);
  });

  test("PERF-04: Leave (self) — LCP within budget", async ({ employeePage }) => {
    await collectLcp(employeePage);
    await gotoAuth(employeePage, "/leave", "main");

    const lcp = await employeePage.evaluate(() => (window as any).__hrmsLcp ?? 0);
    expect(lcp, `leave LCP ${lcp.toFixed(0)}ms`).toBeLessThan(LCP_BUDGET_MS);
  });

  test("PERF-05: Employees directory — LCP within budget", async ({ hrAdminPage }) => {
    await collectLcp(hrAdminPage);
    await gotoAuth(hrAdminPage, "/employees", "main");

    const lcp = await hrAdminPage.evaluate(() => (window as any).__hrmsLcp ?? 0);
    expect(lcp, `employees LCP ${lcp.toFixed(0)}ms`).toBeLessThan(LCP_BUDGET_MS);
  });

  test("PERF-06: Payroll — LCP within budget", async ({ payrollAdminPage }) => {
    await collectLcp(payrollAdminPage);
    await gotoAuth(payrollAdminPage, "/payroll", "main");

    const lcp = await payrollAdminPage.evaluate(() => (window as any).__hrmsLcp ?? 0);
    expect(lcp, `payroll LCP ${lcp.toFixed(0)}ms`).toBeLessThan(LCP_BUDGET_MS);
  });
});
