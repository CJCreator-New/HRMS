import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

/**
 * Suite 20 · NAV-05 — Role-aware dashboard greeting & next actions
 * -----------------------------------------------------------------
 * Source: docs/DESIGN_FLOW_ENHANCEMENT_PLAN.md (WS-A §A5) ·
 *         docs/E2E_TEST_PLAN.md Suite 20
 *
 * ACTIVE since Phase 0. Relies on this data-testid contract:
 *      - `data-testid="dashboard-greeting"`  role-aware h2 heading
 *      - `data-testid="next-actions"`        list of up to 3 contextual action links
 *        (employee → /attendance, /leave; manager → /approvals; hr → /onboarding;
 *         payroll_admin → /payroll; system_admin → /settings)
 */
test.describe("Suite 20: Navigation — Role-Aware Dashboard (NAV-05)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend (ADR 0004); skipped in offline mock mode."
    );
  });

  test("employee sees self-service next actions (punch / leave)", async ({ employeePage: page }) => {
    await page.goto("/");

    await expect(page.locator('[data-testid="dashboard-greeting"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-actions"] a[href="/attendance"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-actions"] a[href="/leave"]')).toBeVisible();
  });

  test("manager sees the approval queue next action", async ({ managerPage: page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="next-actions"] a[href="/approvals"]')).toBeVisible();
  });

  test("hr admin sees the direct onboarding next action", async ({ hrAdminPage: page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="next-actions"] a[href="/onboarding"]')).toBeVisible();
  });

  test("payroll admin sees the payroll run next action", async ({ payrollAdminPage: page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="next-actions"] a[href="/payroll"]')).toBeVisible();
  });

  test("system admin sees the settings gate next action", async ({ sysAdminPage: page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="next-actions"] a[href="/settings"]')).toBeVisible();
  });
});
