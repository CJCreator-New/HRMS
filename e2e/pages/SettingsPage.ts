import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class SettingsPage extends BasePage {
  readonly companyNameInput: Locator;
  readonly noticePeriodInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.companyNameInput = page.locator('input[name="companyName"], input#companyName').first();
    this.noticePeriodInput = page.locator('input[name="noticePeriodDaysDefault"], input[type="number"]').first();
    this.saveButton = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Save Changes")');
  }

  async goto(): Promise<void> {
    await this.navigate("/settings");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/settings.*/);
    await expect(this.page.locator("body")).toContainText(/Settings/i);
  }

  async updateCompanyName(newName: string): Promise<void> {
    await this.companyNameInput.fill(newName);
    await this.saveButton.click();
  }
}
