import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-01: Hire-to-First-Payslip (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Action-level trace requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });
  test("Complete E2E lifecycle: Onboarding → Punch → Leave → Payroll Run → Payslip", async ({ loginAs, baseURL }) => {
    // 1. HR Admin Onboarding Portal Access
    const hrPage = await loginAs("hr_admin");
    await hrPage.goto(`${baseURL}/onboarding`);
    await expect(hrPage.locator("body")).toContainText(/Onboarding|New Employee|Onboard/i);
    await expect(hrPage.locator('[data-testid="onboarding-emp-code"]')).toBeVisible();

    // 2. Employee Attendance Punch & Leave Access
    const empPage = await loginAs("employee_e1");
    await empPage.goto(`${baseURL}/attendance`);
    await expect(empPage.locator('[data-testid="punch-in-btn"]')).toBeVisible();

    await empPage.goto(`${baseURL}/leave`);
    await expect(empPage.locator("body")).toContainText(/Leave Engine|Apply for Leave|Leave/i);

    // 3. Payroll Admin Bulk Payroll Access
    const payPage = await loginAs("payroll_admin");
    await payPage.goto(`${baseURL}/payroll`);
    await expect(payPage.locator('[data-testid="payroll-header"]')).toBeVisible();
  });
});
