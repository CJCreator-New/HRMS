import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Module 05 & 06: Leave Policy & Approval Engine E2E Specs", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded leave allocations (ADR 0004); skipped in offline mock mode."
    );
  });
  test("should render leave balances and quotas grid", async ({ employeePage: page }) => {
    await page.goto("/leave");
    await expect(page.locator('[data-testid="leave-header"]')).toBeVisible();
    await expect(page.locator("body")).toContainText("Annual Leave Balances");
  });

  test("should enforce 90-day comp-off expiry notice per FR §4.6", async ({ employeePage: page }) => {
    await page.goto("/leave");
    await page.fill('[data-testid="compoff-date-input"]', "2026-08-10");
    await page.click('[data-testid="submit-compoff-btn"]');
    await expect(page.locator("body")).toContainText("90-day expiry");
  });

  test("should submit leave application successfully", async ({ employeePage: page }) => {
    await page.goto("/leave");
    await page.fill('[data-testid="start-date-input"]', "2026-09-01");
    await page.fill('[data-testid="end-date-input"]', "2026-09-02");
    await page.fill('[data-testid="leave-reason-input"]', "Personal annual leave");
    await page.click('[data-testid="submit-leave-btn"]');
    await expect(page.locator("body")).toContainText(/Leave Application submitted/i);
  });

  test("should verify manager privacy masking mode for parental leave", async ({ employeePage: page }) => {
    await page.goto("/leave");
    const toggleBtn = page.locator('[data-testid="toggle-manager-view-btn"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.locator("body")).toContainText(/Reason Masked|Full Details/i);
  });
});
