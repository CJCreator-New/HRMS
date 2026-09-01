import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DEFAULT_PASSWORD } from "../fixtures/test-data";

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorBanner: Locator;
  readonly togglePasswordButton: Locator;
  readonly forgotPasswordButton: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.emailInput = page.locator('input[data-testid="login-email"], input[type="email"], input[name="email"]').first();
    this.passwordInput = page.locator('input[data-testid="login-password"], input[type="password"], input[name="password"]').first();
    this.submitButton = page.locator('button[data-testid="login-submit"], button[type="submit"]').first();
    this.errorBanner = page.locator('[data-testid="login-error"], [role="alert"]').first();
    this.togglePasswordButton = page.locator('button[aria-label*="password" i], button[title*="password" i]').first();
    this.forgotPasswordButton = page.locator('button:has-text("Forgot")').first();
  }

  async goto(): Promise<void> {
    await this.navigate("/login");
  }

  async login(email: string, password: string = DEFAULT_PASSWORD): Promise<void> {
    await this.emailInput.click();
    await this.emailInput.fill(email);
    await expect(this.emailInput).toHaveValue(email);

    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await expect(this.passwordInput).toHaveValue(password);

    await this.submitButton.click();
  }

  async assertErrorVisible(errorMatch?: string | RegExp): Promise<void> {
    await expect(this.errorBanner).toBeVisible({ timeout: 8000 });
    if (errorMatch) {
      await expect(this.errorBanner).toContainText(errorMatch);
    }
  }

  async assertOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/login.*/);
  }
}
