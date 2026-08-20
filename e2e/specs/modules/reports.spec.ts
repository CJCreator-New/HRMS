import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Module 19: Executive & Compliance Reports Portal E2E Specs", () => {
  test("should render executive reports catalog", async ({ sysAdminPage: page }) => {
    await page.goto("/reports");
    await expect(page.locator('[data-testid="reports-header"]')).toBeVisible();
    await expect(page.locator("body")).toContainText("Monthly Employee Attendance Summary");
  });

  test("should filter reports catalog by category", async ({ sysAdminPage: page }) => {
    await page.goto("/reports");
    await page.click("button:has-text('Statutory')");
    await expect(page.locator("body")).toContainText("Statutory PF / ESI / PT Compliance Register");
  });

  test("should trigger report export download", async ({ sysAdminPage: page }) => {
    test.skip(
      !(await isSupabaseReachable()),
      "Export action queries the live DB (ADR 0004 hybrid seed); skipped in offline mock mode."
    );
    await page.goto("/reports");
    const exportBtn = page.locator('[data-testid="export-report-btn"]').first();
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();
    await expect(page.locator("body")).toContainText("exported successfully");
  });
});
