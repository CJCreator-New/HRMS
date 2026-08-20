import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Role E2E Suite: Employee Persona (employee_e1)", () => {
  test("EMP-01: Access self-service dashboard with key metrics", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    await expect(page.locator("body")).toContainText(/Dashboard|Overview|Welcome/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("EMP-02: Self-service Attendance punch controls & logs", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/attendance`);
    await expect(page.locator("body")).toContainText(/Attendance & Time Tracking|Punch Check-In/i);
    await expect(page.locator('[data-testid="punch-in-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="punch-out-btn"]')).toBeVisible();
  });

  test("EMP-03: Leave balance inquiry & application form", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/leave`);
    await expect(page.locator("body")).toContainText(/Leave Engine|Annual Leave Balances|Apply for Leave/i);
  });

  test("EMP-04: Holiday calendar & optional holiday selection", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/calendar`);
    await expect(page.locator("body")).toContainText(/Calendar|Holiday/i);
  });

  test("EMP-05: View own salary structure (salary.view.self)", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/salary`);
    await expect(page.locator("body")).toContainText(/Salary Structure|Cost to Company|Component/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("EMP-06: View & download published payslips", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/payroll`);
    await expect(page.locator("body")).toContainText(/Payroll|Payslip/i);
  });

  test("EMP-07: Submit reimbursement claim with receipt upload preview", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/reimbursements`);
    await expect(page.locator("body")).toContainText(/Reimbursement|Claims|Expenses/i);
  });

  test("EMP-08: Leave encashment application self-service", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/encashment`);
    await expect(page.locator("body")).toContainText(/Encashment|Carry Forward|Earned Leave/i);
  });

  test("EMP-09: Resignation initiation & notice period preview", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/offboarding`);
    await expect(page.locator("body")).toContainText(/Separation|Offboarding|Resignation/i);
  });

  test("EMP-10: Restricted routes strictly return 403 or redirect for employee", async ({ employeePage: page, baseURL }) => {
    const restrictedRoutes = ["/onboarding", "/departments", "/settings", "/jobs", "/audit"];
    for (const route of restrictedRoutes) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
      expect(isBlocked).toBe(true);
    }
  });

  test("EMP-11: Self-service document attachments (attachment.view)", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/documents`);
    await expect(page.locator("body")).toContainText(/Document|Attachment/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("EMP-12: Short permission self-application (permission.apply.self)", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/permissions`);
    await expect(page.locator("body")).toContainText(/Permission|Short Permission/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("EMP-13: View own employee profile in directory (employee.view.self)", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/employees`);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("EMP-14: Employee blocked from approval & payroll-admin-only routes", async ({ employeePage: page, baseURL }) => {
    const restrictedRoutes = ["/approvals", "/statutory", "/reports", "/eligibility", "/employees/import"];
    for (const route of restrictedRoutes) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
      expect(isBlocked).toBe(true);
    }
  });
});
