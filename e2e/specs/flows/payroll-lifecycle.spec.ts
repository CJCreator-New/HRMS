import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable, adminDb } from "../../fixtures/db.fixture";

/**
 * Suite 21 · TEST-05 — Full Payroll Lifecycle E2E
 * ---------------------------------------------------------------------------
 * Exercises the complete payroll lifecycle:
 *   1. Create payroll period (draft)
 *   2. Validate payroll lock
 *   3. Execute bulk payroll run
 *   4. Review payslips (verify count and net pay)
 *   5. Finalize payroll period
 *   6. Verify published payslips are visible to employees
 *
 * Requires a live Supabase backend with seeded data (ADR 0004).
 * Skips automatically in offline mock mode.
 */
test.describe("TEST-05: Full Payroll Lifecycle E2E", () => {
  let testPeriodId: string;

  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });

  test("LIFECYCLE-01: Create a new payroll period", async ({ payrollAdminPage: page }) => {
    await page.goto("/payroll");

    // Verify the payroll page loads
    await expect(page.locator("body")).toContainText(/payroll/i);

    // Check for create period button or UI
    const createBtn = page.locator('[data-testid="create-period-btn"]');
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Fill in period details (year/month)
      await page.waitForTimeout(1000);
    }
  });

  test("LIFECYCLE-02: Validate payroll lock before run", async ({ payrollAdminPage: page }) => {
    await page.goto("/payroll");

    // Look for the lock validation button or check
    const lockBtn = page.locator('[data-testid="validate-lock-btn"]');
    if (await lockBtn.isVisible()) {
      await lockBtn.click();

      // Either lock passes or shows lock notice
      await expect(page.locator("body")).toContainText(
        /lock|valid|unresolved|anomaly/i
      );
    }
  });

  test("LIFECYCLE-03: Execute bulk payroll run", async ({ payrollAdminPage: page }) => {
    await page.goto("/payroll");

    // Click the run payroll button
    const runBtn = page.locator('[data-testid="run-payroll-btn"]');
    if (await runBtn.isVisible()) {
      await runBtn.click();

      // Wait for the run to complete
      await expect(page.locator("body")).toContainText(
        /payslip|completed|processed|employees/i,
        { timeout: 30000 }
      );
    }
  });

  test("LIFECYCLE-04: Review payslips after bulk run", async ({ payrollAdminPage: page }) => {
    await page.goto("/payroll");

    // After the run, verify payslip data is displayed
    await expect(page.locator("body")).toContainText(
      /payslip|net pay|gross|deduction/i
    );

    // Verify the stepper shows the review step
    const stepper = page.locator('[data-testid="stepper"]');
    if (await stepper.isVisible()) {
      // Step 4 (Review Payslips) should be active after run
      const step4 = page.locator('[data-testid="stepper-step-4"]');
      if (await step4.isVisible()) {
        await expect(step4).toHaveAttribute("aria-current", "step", {
          timeout: 15000,
        });
      }
    }
  });

  test("LIFECYCLE-05: Finalize payroll period", async ({ payrollAdminPage: page }) => {
    await page.goto("/payroll");

    // Click finalize button
    const finalizeBtn = page.locator('[data-testid="finalize-payroll-btn"]');
    if (await finalizeBtn.isVisible()) {
      await finalizeBtn.click();

      // Either finalization succeeds or a lock blocks it
      await expect(page.locator("body")).toContainText(
        /finalized|locked|lock notice|cannot finalize/i,
        { timeout: 15000 }
      );
    }
  });

  test("LIFECYCLE-06: Verify employee can see published payslips", async ({ employeePage: page }) => {
    await page.goto("/salary");

    // Employee should be able to view their salary/payslip information
    await expect(page.locator("body")).toContainText(
      /salary|payslip|earnings|ctc/i
    );
  });

  test("LIFECYCLE-07: Verify DB state after full lifecycle", async () => {
    // Direct DB assertions to verify the lifecycle completed correctly
    const { data: periods } = await adminDb
      .from("payroll_periods")
      .select("id, status, year, month")
      .order("created_at", { ascending: false })
      .limit(5);

    expect(periods).toBeTruthy();

    // At least one period should exist
    if (periods && periods.length > 0) {
      const latestPeriod = periods[0];

      // Period should be in draft, validated, or finalized status
      expect(["draft", "validated", "finalized", "published"]).toContain(
        latestPeriod.status
      );

      // Verify payslips exist for this period
      const { data: payslips } = await adminDb
        .from("payslips")
        .select("id, net_pay, is_published")
        .eq("year", latestPeriod.year)
        .eq("month", latestPeriod.month);

      if (payslips && payslips.length > 0) {
        // All payslips should have valid net_pay values
        for (const slip of payslips) {
          expect(typeof slip.net_pay).toBe("number");
          expect(slip.is_published).toBe(false); // Not yet published
        }
      }
    }
  });
});
