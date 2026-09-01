import { test, expect } from "../../fixtures/auth.fixture";
import { LoginPage } from "../../pages/LoginPage";
import { TEST_PERSONAS, DEFAULT_PASSWORD } from "../../fixtures/test-data";

test.describe("Suite 00: Foundation & Auth (P0)", () => {
  test("HEALTH-01: Health endpoint responds with valid status payload", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL || ""}/api/health`);
    expect([200, 503]).toContain(res.status());
    const data = await res.json();
    expect(["healthy", "ok", "pass", "unreachable"]).toContain(data.status);
  });

  test("AUTH-04: Unauthenticated redirect to /login", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/attendance`);
    await expect(page).toHaveURL(/.*\/login.*/);
  });

  test("AUTH-02: Invalid credentials rejected with error message", async ({ page, baseURL }) => {
    const loginPage = new LoginPage(page, baseURL);
    await loginPage.goto();
    await loginPage.login("invalid.user@company.com", "WrongPassword123!");
    await loginPage.assertErrorVisible();
  });

  test("AUTH-01 / AUTH-05: Successful login loads dashboard", async ({ page, baseURL }) => {
    const loginPage = new LoginPage(page, baseURL);
    await loginPage.goto();
    await loginPage.login(TEST_PERSONAS.sys_admin.email, DEFAULT_PASSWORD);

    await expect(page).not.toHaveURL(/.*\/login.*/, {
      timeout: 15000,
    });

    await page.goto(`${baseURL}/`);
    await expect(page).toHaveURL(new RegExp(`${baseURL}/?$`));
    await expect(page.locator("h1").first()).toContainText("HRMS");
  });

  test("AUTH-06: Logout clears session and redirects to /login", async ({ sysAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1").first()).toContainText("HRMS");

    const logoutBtn = page.locator('button[aria-label="Sign out of system"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await expect(page).toHaveURL(/.*\/login.*/, { timeout: 15000 });
  });
});
