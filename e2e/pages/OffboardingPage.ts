import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class OffboardingPage extends BasePage {
  readonly employeeSelect: Locator;
  readonly resignationDateInput: Locator;
  readonly noticeDaysInput: Locator;
  readonly submitResignationButton: Locator;
  readonly clearanceCheckboxes: Locator;
  readonly approveFfButton: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.employeeSelect = page.locator('select#resigEmpSelect, select');
    this.resignationDateInput = page.locator('input#resigDateInput, input[type="date"]').first();
    this.noticeDaysInput = page.locator('input#noticeDaysInput, input[type="number"]').first();
    this.submitResignationButton = page.locator('button[type="submit"]:has-text("Initiate"), button:has-text("Submit Resignation")');
    this.clearanceCheckboxes = page.locator('input[type="checkbox"]');
    this.approveFfButton = page.locator('button:has-text("Approve F&F"), button:has-text("Approve Settlement")');
  }

  async goto(): Promise<void> {
    await this.navigate("/offboarding");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/offboarding.*/);
    await expect(this.page.locator("body")).toContainText(/Offboarding|Separation/i);
  }

  async submitResignation(noticeDays: number = 30): Promise<void> {
    await this.noticeDaysInput.fill(String(noticeDays));
    await this.submitResignationButton.click();
  }
}
