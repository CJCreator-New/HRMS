import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

/**
 * Suite 20 · FLW-01…FLW-02 — Payroll cycle stepper bound to payroll_periods.status
 * -------------------------------------------------------------------------------
 * Source: docs/DESIGN_FLOW_ENHANCEMENT_PLAN.md (WS-C §C1) ·
 *         docs/E2E_TEST_PLAN.md Suite 20
 *
 * ACTIVATED in Phase 2 — 5-step stepper bound to payroll_periods.status shipped
 * on /payroll (WS-C §C1). data-testid contract implemented by
 * src/components/shared/Stepper.tsx (`stepper` container, `stepper-step-N`).
 *
 * data-testid contract:
 *  - `data-testid="stepper"`                       stepper container
 *  - `data-testid="stepper-step-1"…"stepper-step-5"` 5 steps; active step has `aria-current="step"`
 *  - existing action testids preserved: `run-payroll-btn`, `finalize-payroll-btn`, `reopen-payroll-btn`
 *  - lock failures still surface the `ErrorBanner` "Payroll Lock Notice" title
 *
 * NOTE: FLW-02 assumes the seeded payroll period has an unresolved lock condition
 * (unresolved attendance anomaly / pending leave) so finalization is blocked.
 */
test.describe("Suite 20: Guided Workflows — Payroll Stepper (FLW-01, FLW-02)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded payroll period (ADR 0004); skipped in offline mock mode."
    );
  });

  test("FLW-01: stepper renders 5 steps and advances through the run flow", async ({ payrollAdminPage: page }) => {
    await page.goto("/payroll");

    await expect(page.locator('[data-testid="stepper"]')).toBeVisible();
    for (let step = 1; step <= 5; step++) {
      await expect(page.locator(`[data-testid="stepper-step-${step}"]`)).toBeVisible();
    }

    // draft period → step 1 (Period & Eligibility) is active
    await expect(page.locator('[data-testid="stepper-step-1"]')).toHaveAttribute("aria-current", "step");

    await page.click('[data-testid="run-payroll-btn"]');

    // after the bulk run the Review Payslips step becomes active
    await expect(page.locator('[data-testid="stepper-step-4"]')).toHaveAttribute("aria-current", "step", {
      timeout: 15000,
    });
  });

  test("FLW-02: finalization is blocked by the payroll lock and the stepper does not advance to step 5", async ({
    payrollAdminPage: page,
  }) => {
    await page.goto("/payroll");

    await page.click('[data-testid="finalize-payroll-btn"]');

    await expect(page.locator("body")).toContainText(/Payroll Lock Notice/i);
    await expect(page.locator('[data-testid="stepper-step-5"]')).not.toHaveAttribute("aria-current", "step");
  });
});
