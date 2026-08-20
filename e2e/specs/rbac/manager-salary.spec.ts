import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Suite 01: Manager Salary Restriction (FR §5.8)", () => {
  test("RBAC-11: Manager route gate hides /salary and blocks direct URL access", async ({ managerPage: page, baseURL }) => {
    // 1. Verify nav link is absent
    const salaryNavLink = page.locator('a[data-testid="nav-salary"]');
    await expect(salaryNavLink).toHaveCount(0);

    // 2. Direct URL access redirects to /403 or shows restriction card / login
    await page.goto(`${baseURL}/salary`);
    const currentUrl = page.url();
    const isBlocked = currentUrl.includes("/403") || currentUrl.includes("/login") || currentUrl.endsWith("/");
    expect(isBlocked).toBe(true);
  });
});
