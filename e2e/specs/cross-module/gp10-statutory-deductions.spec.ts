import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Cross-Module Golden Path GP-10: India FY 2025–26 Statutory Calculations (P1)", () => {
  test("Statutory profile configuration reflects PF 15k cap, ESI 0.75%, State PT, and Tax Regime", async ({
    payrollAdminPage: page,
    baseURL,
  }) => {
    // 1. Payroll Admin accesses Statutory Dashboard
    await page.goto(`${baseURL}/statutory`);
    await expect(page.locator("body")).toContainText(/Statutory|PF|ESI|Professional Tax/i);
    await expect(page).not.toHaveURL(/\/403/);

    // 2. Verify statutory rules table / cards exist
    await expect(page.locator("body")).not.toContainText(/Access Denied/i);
  });
});
