import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Role E2E Suite: System Admin Persona (sys_admin)", () => {
  test("SYS-01: Company Settings Configuration & Zero-Seed Unlock Gate", async ({ sysAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/settings`);
    await expect(page.locator("body")).toContainText(/Company Settings|Organization Setup|Configured/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("SYS-02: RBAC Matrix & Role Assignment Portal", async ({ sysAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/permissions`);
    await expect(page.locator("body")).toContainText(/Permissions|Roles|RBAC/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("SYS-03: System Audit Trail & Immutable Log Explorer", async ({ sysAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/audit`);
    await expect(page.locator("body")).toContainText(/Audit|Logs|Activity/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("SYS-04: Scheduled Jobs Dashboard & Manual Cron Triggers", async ({ sysAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/jobs`);
    await expect(page.locator("body")).toContainText(/Jobs|Cron|Scheduler/i);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("SYS-05: Global Platform Access across core routes", async ({ sysAdminPage: page, baseURL }) => {
    const coreRoutes = ["/", "/attendance", "/leave", "/payroll", "/salary", "/employees", "/offboarding", "/reports"];
    for (const route of coreRoutes) {
      await page.goto(`${baseURL}${route}`);
      await expect(page).not.toHaveURL(/\/403/);
    }
  });

  test("SYS-06: Bypass reaches remaining modules (documents, employees, statutory, calendar)", async ({ sysAdminPage: page, baseURL }) => {
    const bypassRoutes = ["/documents", "/employees", "/statutory", "/calendar", "/reimbursements", "/encashment"];
    for (const route of bypassRoutes) {
      await page.goto(`${baseURL}${route}`);
      await expect(page).not.toHaveURL(/\/403/);
    }
  });
});
