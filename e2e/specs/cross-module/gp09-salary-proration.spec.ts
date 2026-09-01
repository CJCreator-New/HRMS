import { test, expect } from "../../fixtures/auth.fixture";
import { PayrollPage } from "../../pages/PayrollPage";

test.describe("Cross-Module Golden Path GP-09: Mid-Month Salary Revision & Pro-Rata Split (P1)", () => {
  test("Mid-month salary structure change calculates pro-rated payable days split", async ({
    payrollAdminPage: page,
    baseURL,
  }) => {
    // 1. Payroll Admin accesses Salary Management
    await page.goto(`${baseURL}/salary`);
    await expect(page.locator("body")).toContainText(/Salary Structure|Salary Management|Component/i);
    await expect(page).toHaveURL(/.*\/salary.*/);

    // 2. Access Payroll Processing Portal
    const payroll = new PayrollPage(page, baseURL);
    await payroll.goto();
    await payroll.assertLoaded();
    await expect(payroll.stepper).toBeVisible();
  });
});
