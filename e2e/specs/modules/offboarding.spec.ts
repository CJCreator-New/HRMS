import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Module 12: Separation & Full & Final Settlement E2E Specs", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded separations (ADR 0004); skipped in offline mock mode."
    );
  });
  test("should render separation dashboard header", async ({ hrAdminPage: page }) => {
    await page.goto("/offboarding");
    await expect(page.locator('[data-testid="offboarding-header"]')).toBeVisible();
  });

  test("should submit resignation and calculate last working day", async ({ hrAdminPage: page }) => {
    await page.goto("/offboarding");
    const submitBtn = page.locator('[data-testid="submit-resignation-btn"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    await expect(page.locator("body")).toContainText(/Resignation submitted/i);
  });

  test("should display departmental clearance tracker", async ({ hrAdminPage: page }) => {
    await page.goto("/offboarding");
    await expect(page.locator('[data-testid="clearance-matrix"]')).toBeVisible();
    await expect(page.locator("body")).toContainText("Department Offboarding Clearance Checklist");
  });
});
