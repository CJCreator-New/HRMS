import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Role E2E Suite: Payroll Admin Persona (payroll_admin)", () => {
  test("PAY-01: Payroll Processing Engine & Periods Management", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/payroll`);
    await expect(page.locator("body")).toContainText(/Payroll|Payroll Core/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("PAY-02: Salary Structure Component & CTC Assignment Portal", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/salary`);
    await expect(page.locator("body")).toContainText(/Salary Structure|Cost to Company/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("PAY-03: Statutory Rules & Tax Regimes Configuration (FY 2025–26)", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/statutory`);
    await expect(page.locator("body")).toContainText(/Statutory|PF|ESI|Professional Tax/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("PAY-04: Binary Payroll Eligibility Management Portal", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/eligibility`);
    await expect(page.locator("body")).toContainText(/Eligibility|Payroll/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("PAY-05: Read-Only Operational Banners on Core Ops Pages (Q11)", async ({ payrollAdminPage: page, baseURL }) => {
    // 1. Attendance page
    await page.goto(`${baseURL}/attendance`);
    await expect(page.locator("body")).toContainText(/Attendance & Time Tracking|Read-Only|Payroll Admin/i);

    // 2. Leave page
    await page.goto(`${baseURL}/leave`);
    await expect(page.locator("body")).toContainText(/Leave Engine|Read-Only|Payroll Admin/i);
  });

  test("PAY-06: Blocked Admin routes return 403 or redirect for Payroll Admin", async ({ payrollAdminPage: page, baseURL }) => {
    const blockedRoutes = ["/onboarding", "/departments", "/jobs", "/settings"];
    for (const route of blockedRoutes) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
      expect(isBlocked).toBe(true);
    }
  });

  test("PAY-07: Executive & compliance report exports (reports.export)", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/reports`);
    await expect(page.locator("body")).toContainText(/Reports|Export/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("PAY-08: F&F view, reimbursements & documents (read-only ops)", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/offboarding`);
    await expect(page.locator("body")).toContainText(/Separation|Settlement/i);
    await expect(page).not.toHaveURL(/\/403/);

    await page.goto(`${baseURL}/reimbursements`);
    await expect(page.locator("body")).toContainText(/Reimbursement|Claim/i);
    await expect(page).not.toHaveURL(/\/403/);

    await page.goto(`${baseURL}/documents`);
    await expect(page.locator("body")).toContainText(/Document|Attachment/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("PAY-09: All-employee directory access (employee.view.all)", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/employees`);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("PAY-10: Payroll admin blocked from approvals & people-ops routes", async ({ payrollAdminPage: page, baseURL }) => {
    const restrictedRoutes = ["/approvals", "/permissions", "/audit", "/encashment"];
    for (const route of restrictedRoutes) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
      expect(isBlocked).toBe(true);
    }
  });
});
