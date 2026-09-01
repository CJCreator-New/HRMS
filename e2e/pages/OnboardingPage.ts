import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class OnboardingPage extends BasePage {
  readonly empCodeInput: Locator;
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly dojInput: Locator;
  readonly nextButton: Locator;
  readonly confirmButton: Locator;
  readonly stepper: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.empCodeInput = page.locator('[data-testid="onboarding-emp-code"], input#employeeCode');
    this.fullNameInput = page.locator('[data-testid="onboarding-full-name"], input#fullName');
    this.emailInput = page.locator('[data-testid="onboarding-email"], input#email');
    this.dojInput = page.locator('[data-testid="onboarding-doj"], input#dateOfJoining');
    this.nextButton = page.locator('[data-testid="onboarding-next-btn"], button[type="submit"]:has-text("Next")');
    this.confirmButton = page.locator('[data-testid="onboarding-confirm-btn"], button[type="submit"]:has-text("Confirm")');
    this.stepper = page.locator('[data-testid="stepper"]');
  }

  async goto(): Promise<void> {
    await this.navigate("/onboarding");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/onboarding.*/);
    await expect(this.empCodeInput).toBeVisible();
  }

  async onboardEmployee(empCode: string, name: string, email: string, doj: string = "2026-08-15"): Promise<void> {
    await this.empCodeInput.fill(empCode);
    await this.fullNameInput.fill(name);
    await this.emailInput.fill(email);
    await this.dojInput.fill(doj);
    await this.nextButton.click();

    await expect(this.confirmButton).toBeVisible({ timeout: 5000 });
    await this.confirmButton.click();
  }
}
