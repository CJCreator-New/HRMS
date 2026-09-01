import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class PermissionsPage extends BasePage {
  readonly quotaBadge: Locator;
  readonly dateInput: Locator;
  readonly startTimeInput: Locator;
  readonly endTimeInput: Locator;
  readonly reasonInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.quotaBadge = page.locator('span:has-text("120"), span:has-text("Minutes"), [data-testid="quota-badge"]').first();
    this.dateInput = page.locator('input[type="date"]').first();
    this.startTimeInput = page.locator('input[type="time"], input[name="startTime"]').first();
    this.endTimeInput = page.locator('input[type="time"], input[name="endTime"]').last();
    this.reasonInput = page.locator("textarea").first();
    this.submitButton = page.locator('button[type="submit"]:has-text("Request"), button:has-text("Submit Permission")');
  }

  async goto(): Promise<void> {
    await this.navigate("/permissions");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/permissions.*/);
    await expect(this.page.locator("body")).toContainText(/Permission/i);
  }

  async requestPermission(dateStr: string = "2026-08-20", reason: string = "Doctor appointment"): Promise<void> {
    await this.dateInput.fill(dateStr);
    await this.reasonInput.fill(reason);
    await this.submitButton.click();
  }
}
