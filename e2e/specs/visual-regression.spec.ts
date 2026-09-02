import { test, expect } from "@playwright/test";

test.describe("Visual Regression Testing (P3-4)", () => {
  test("login page matches visual baseline snapshot", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Mask dynamic / animated elements if any
    await expect(page).toHaveScreenshot("login-page.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });
  });

  test("password reset page matches visual baseline snapshot", async ({ page }) => {
    await page.goto("/auth/reset-password");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("reset-password-page.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });
  });

  test("email confirm page matches visual baseline snapshot", async ({ page }) => {
    await page.goto("/auth/confirm");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("confirm-email-page.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });
  });
});
