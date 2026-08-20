import { test, expect } from "@playwright/test";
import { TEST_PERSONAS, DEFAULT_PASSWORD } from "../../fixtures/test-data";

test.describe("Suite 00: Foundation & Auth (P0)", () => {
  test("AUTH-04: Unauthenticated redirect to /login", async ({ page }) => {
    await page.goto("/attendance");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH-02: Invalid credentials rejected with error message", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "invalid.user@company.com");
    await page.fill('input[type="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');
    
    // Expect error alert or message
    await expect(page.locator('[data-testid="login-error"], .bg-red-50')).toBeVisible();
  });

  test("AUTH-01 / AUTH-05: Successful login loads dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_PERSONAS.sys_admin.email);
    await page.fill('input[type="password"]', DEFAULT_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for the login action to set the mock cookie and the client-side
    // window.location.href redirect to complete (no fixed timeout).
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 10000,
    });

    // After redirect, navigate to dashboard to confirm full access.
    await page.goto("/");
    await expect(page).toHaveURL("/");
    // Two h1s exist: sidebar brand + page heading. Use first() to avoid strict-mode violation.
    await expect(page.locator("h1").first()).toContainText("HRMS");
  });
});
