import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Module 07-10: Payroll Processing & Statutory Engine E2E Specs", () => {
  test("should render payroll engine control bar", async ({ payrollAdminPage: page }) => {
    await page.goto("/payroll");
    await expect(page.locator('[data-testid="payroll-header"]')).toBeVisible();
    await expect(page.locator("body")).toContainText(/Payroll Core Engine/i);
  });

  test("should display Module 08 Binary Payroll Eligibility Widget", async ({ payrollAdminPage: page }) => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend (payroll page load is DB-driven); skipped in offline mock mode."
    );
    await page.goto("/payroll");
    await expect(page.locator('[data-testid="payroll-eligibility-widget"]')).toBeVisible();
    await expect(page.locator("body")).toContainText(/Eligible Employees/i);
  });

  test("should open payslip statement modal and verify print trigger", async ({ payrollAdminPage: page }) => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend with generated payslips (ADR 0004); skipped in offline mock mode."
    );
    await page.goto("/payroll");
    const viewPayslipBtn = page.locator('[data-testid="view-payslip-btn"]').first();
    await expect(viewPayslipBtn).toBeVisible();
    await viewPayslipBtn.click();
    await expect(page.locator("body")).toContainText("Payslip Statement");
    await expect(page.locator('[data-testid="print-payslip-btn"]')).toBeVisible();
  });
});
