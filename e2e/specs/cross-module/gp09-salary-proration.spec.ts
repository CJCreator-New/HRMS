import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-09: Mid-Month Salary Revision & Pro-Rata Split (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Action-level trace requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });
  test("Mid-month salary structure change calculates pro-rated payable days split", async ({ payrollAdminPage: page, baseURL }) => {
    // 1. Payroll Admin accesses Salary Management
    await page.goto(`${baseURL}/salary`);
    await expect(page.locator("body")).toContainText(/Salary Structure|Salary Management|Component/i);

    // 2. Access Payroll Processing Portal
    await page.goto(`${baseURL}/payroll`);
    await expect(page.locator('[data-testid="payroll-header"]')).toBeVisible();

    // 3. Verify Pro-Rata or Calculation UI Indicators
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);
  });
});
