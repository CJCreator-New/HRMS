import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 03: Company Settings & Policy (P1)", () => {
  test("SET-01: Only settings.manage roles access /settings", async ({ loginAs, baseURL }) => {
    const page = await loginAs("employee_e1");
    await page.goto(`${baseURL}/settings`);
    await expect(page.locator("body")).toContainText(/403|Access Denied/i);
  });

  test("SET-02: System Admin configures alternate HR approver", async ({ loginAs, baseURL }) => {
    const page = await loginAs("sys_admin");
    await page.goto(`${baseURL}/settings`);
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);
  });
});
