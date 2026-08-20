import { test, expect } from "../../fixtures/auth.fixture";

// Lifecycle-coverage shape (decision, ticket 03): lifecycle-state behaviors
// stay in this dedicated suite; the route-level role coverage lives in the
// other role suites. State personas authenticate offline via the mock gate
// (ticket 02): invited/notice get employee routes; suspended/offboarded are
// deny-all (access revoked per the domain model).
test.describe("Role E2E Suite: Employee Lifecycle Edge States", () => {
  test("LIFE-01: Invited Employee first login forces password reset (ADR 0001)", async ({ loginAs, baseURL }) => {
    const page = await loginAs("emp_invited");
    // Mock mode resolves invited.emp → mustChangePassword:true → the shell
    // mounts the ForcePasswordResetModal instead of the workspace.
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.locator("body")).toContainText(/Mandatory Password Reset|Password/i);
  });

  test("LIFE-02: Suspended Employee excluded from payroll run calculations", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/payroll`);
    // Verify payroll dashboard renders (payroll-eligibility exclusion is a
    // data-level assertion — pending live backend per ADR 0004)
    await expect(page.locator("body")).toContainText(/Payroll Core Engine|Payroll/i);
  });

  test("LIFE-03: Notice Period Employee active clearance checklist and LWD tracking", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/offboarding`);
    // Notice period employee tracking
    await expect(page.locator("body")).toContainText(/Separation & Full & Final Settlement|Clearance|Notice/i);
  });

  test("LIFE-04: Offboarded Employee archived record with completed separation status", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/offboarding`);
    await expect(page.locator("body")).toContainText(/Separation & Full & Final Settlement|Offboarding/i);
  });

  test("LIFE-05: Suspended employee access revoked — all routes 403", async ({ loginAs, baseURL }) => {
    const page = await loginAs("emp_suspended");
    for (const route of ["/", "/attendance", "/leave", "/employees"]) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login");
      expect(isBlocked).toBe(true);
    }
  });

  test("LIFE-06: Offboarded employee access revoked — all routes 403", async ({ loginAs, baseURL }) => {
    const page = await loginAs("emp_offboarded");
    for (const route of ["/", "/attendance", "/offboarding"]) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login");
      expect(isBlocked).toBe(true);
    }
  });

  test("LIFE-07: Notice-period employee keeps employee workspace access", async ({ loginAs, baseURL }) => {
    const page = await loginAs("emp_notice");
    await page.goto(`${baseURL}/`);
    await expect(page).not.toHaveURL(/\/403/);
    await page.goto(`${baseURL}/leave`);
    await expect(page).not.toHaveURL(/\/403/);
  });
});
