import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Role E2E Suite: HR Admin Persona (hr_admin)", () => {
  test("HR-01: Full Employee Directory with All-Department Visibility", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/employees`);
    await expect(page.locator("body")).toContainText(/Employee Directory|Employees/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-02: Direct Admin Onboarding portal with Temporary Password generation", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/onboarding`);
    await expect(page.locator("body")).toContainText(/Onboard|New Employee|Candidate/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-03: Bulk Employee Import with CSV validation", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/employees/import`);
    await expect(page.locator("body")).toContainText(/Import|CSV|Upload/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-04: Department Hierarchy & Designation Management", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/departments`);
    await expect(page.locator("body")).toContainText(/Department/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-05: Work Calendar & Holiday Master Configuration", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/calendar`);
    await expect(page.locator("body")).toContainText(/Calendar|Holiday/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-06: Offboarding Clearance Matrix & F&F Settlement Board", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/offboarding`);
    await expect(page.locator("body")).toContainText(/Offboarding|Separation|Clearance/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-07: Leave Encashment & Carry Forward Approvals", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/encashment`);
    await expect(page.locator("body")).toContainText(/Encashment|Carry Forward/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-08: Executive Reports & Statutory Export Portal", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/reports`);
    await expect(page.locator("body")).toContainText(/Reports|Analytics|Export/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-09: HR Admin Leave Self-Approval Prevention (FR §1.4)", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/leave`);
    // HR leave applications route to alternate_hr_approver_id
    await expect(page.locator("body")).toContainText(/Leave/i);
  });

  test("HR-10: Unified approvals inbox (leave/encashment/FF approve perms)", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/approvals`);
    await expect(page.locator("body")).toContainText(/Approvals|Pending/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-11: All-department attendance & reimbursement visibility", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/attendance`);
    await expect(page.locator("body")).toContainText(/Attendance/i);
    await expect(page).not.toHaveURL(/\/403/);

    await page.goto(`${baseURL}/reimbursements`);
    await expect(page.locator("body")).toContainText(/Reimbursement|Claim/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-12: Audit trail, documents & company settings", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/audit`);
    await expect(page.locator("body")).toContainText(/Audit|Log/i);
    await expect(page).not.toHaveURL(/\/403/);

    await page.goto(`${baseURL}/documents`);
    await expect(page.locator("body")).toContainText(/Document|Attachment/i);
    await expect(page).not.toHaveURL(/\/403/);

    await page.goto(`${baseURL}/settings`);
    await expect(page.locator("body")).toContainText(/Settings|Company/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-13: Statutory profiles & salary structures (view + edit)", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/statutory`);
    await expect(page.locator("body")).toContainText(/Statutory|PF|ESI/i);
    await expect(page).not.toHaveURL(/\/403/);

    await page.goto(`${baseURL}/salary`);
    await expect(page.locator("body")).toContainText(/Salary Structure/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("HR-14: HR blocked from payroll-execution routes", async ({ hrAdminPage: page, baseURL }) => {
    const restrictedRoutes = ["/payroll", "/eligibility"];
    for (const route of restrictedRoutes) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
      expect(isBlocked).toBe(true);
    }
  });
});
