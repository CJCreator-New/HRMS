import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Role E2E Suite: Manager Persona (manager_m1)", () => {
  test("MGR-01: Manager Access to Unified Approvals Portal", async ({ managerPage: page, baseURL }) => {
    await page.goto(`${baseURL}/approvals`);
    await expect(page.locator("body")).toContainText(/Approvals|Pending Requests/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("MGR-02: Team attendance review & correction approvals", async ({ managerPage: page, baseURL }) => {
    await page.goto(`${baseURL}/attendance`);
    await expect(page.locator("body")).toContainText(/Attendance/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("MGR-03: Team leave requests with Parental Leave privacy masking (FR §4.7)", async ({ managerPage: page, baseURL }) => {
    await page.goto(`${baseURL}/leave`);
    await expect(page.locator("body")).toContainText(/Leave Engine|Apply for Leave|Leave/i);
    // Manager must not see unmasked medical/maternity reasons
    await expect(page.locator("body")).not.toContainText(/Maternity Complications|Personal Medical Sensitive/i);
  });

  test("MGR-04: Reimbursements stage-1 review & approval queue", async ({ managerPage: page, baseURL }) => {
    await page.goto(`${baseURL}/reimbursements`);
    await expect(page.locator("body")).toContainText(/Reimbursement|Claims/i);
  });

  test("MGR-05: Strict Manager Salary Isolation (FR §5.8)", async ({ managerPage: page, baseURL }) => {
    // 1. Navigation item must not exist in sidebar
    await page.goto(`${baseURL}/`);
    await expect(page.locator('nav a[href="/salary"]')).toHaveCount(0);

    // 2. Direct URL navigation to /salary must return 403 or redirect
    await page.goto(`${baseURL}/salary`);
    const url = page.url();
    const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
    expect(isBlocked).toBe(true);
  });

  test("MGR-06: Manager blocked from Technical Admin & Org Setup routes", async ({ managerPage: page, baseURL }) => {
    const adminRoutes = ["/onboarding", "/departments", "/settings", "/jobs", "/audit", "/eligibility"];
    for (const route of adminRoutes) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
      expect(isBlocked).toBe(true);
    }
  });

  test("MGR-07: Short permission approval queue (permission.approve)", async ({ managerPage: page, baseURL }) => {
    await page.goto(`${baseURL}/permissions`);
    await expect(page.locator("body")).toContainText(/Permission/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("MGR-08: Team document attachments (attachment.view)", async ({ managerPage: page, baseURL }) => {
    await page.goto(`${baseURL}/documents`);
    await expect(page.locator("body")).toContainText(/Document|Attachment/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("MGR-09: Offboarding access — separation initiation (separation.create)", async ({ managerPage: page, baseURL }) => {
    await page.goto(`${baseURL}/offboarding`);
    await expect(page.locator("body")).toContainText(/Separation|Offboarding/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("MGR-10: Manager blocked from pay & compliance routes", async ({ managerPage: page, baseURL }) => {
    const restrictedRoutes = ["/statutory", "/reports", "/payroll", "/encashment", "/employees/import"];
    for (const route of restrictedRoutes) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
      expect(isBlocked).toBe(true);
    }
  });
});
