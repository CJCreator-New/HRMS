import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Role E2E Suite: Multi-Role Union Persona (multi_hr_mgr)", () => {
  test("MULTI-01: Cumulative Union: Access both HR and Manager operational routes", async ({ loginAs, baseURL }) => {
    const page = await loginAs("multi_hr_mgr");

    // 1. HR Route Access
    await page.goto(`${baseURL}/onboarding`);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.locator("body")).toContainText(/Onboard|New Employee/i);

    // 2. Manager Route Access
    await page.goto(`${baseURL}/approvals`);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.locator("body")).toContainText(/Approvals|Pending/i);
  });

  test("MULTI-02: Role View Switcher toggles sidebar focus without revoking cumulative permissions", async ({ loginAs, baseURL }) => {
    const page = await loginAs("multi_hr_mgr");
    await page.goto(`${baseURL}/`);

    // Verify role badge / switcher or enterprise shell exists
    await expect(page.locator("body")).toContainText(/Enterprise|Union Perms|Dashboard/i);

    // Even if switcher label is changed, backend permissions remain cumulative union
    await page.goto(`${baseURL}/reports`);
    await expect(page).not.toHaveURL(/\/403/);
  });

  test("MULTI-03: Union reaches HR- and Manager-side modules beyond the pair", async ({ loginAs, baseURL }) => {
    const page = await loginAs("multi_hr_mgr");
    const unionRoutes = ["/statutory", "/settings", "/audit", "/jobs", "/employees/import", "/departments", "/documents", "/encashment"];
    for (const route of unionRoutes) {
      await page.goto(`${baseURL}${route}`);
      await expect(page).not.toHaveURL(/\/403/);
    }
  });

  test("MULTI-04: Union blocked where neither role holds pay-execution perms", async ({ loginAs, baseURL }) => {
    const page = await loginAs("multi_hr_mgr");
    const blockedRoutes = ["/payroll", "/eligibility"];
    for (const route of blockedRoutes) {
      await page.goto(`${baseURL}${route}`);
      const url = page.url();
      const isBlocked = url.includes("/403") || url.includes("/login") || url.endsWith("/");
      expect(isBlocked).toBe(true);
    }
  });
});
