import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ReimbursementsPage extends BasePage {
  readonly categorySelect: Locator;
  readonly dateInput: Locator;
  readonly vendorInput: Locator;
  readonly amountInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.categorySelect = page.locator("select").first();
    this.dateInput = page.locator('input[type="date"]').first();
    this.vendorInput = page.locator('input[type="text"]').first();
    this.amountInput = page.locator('input[type="number"]').first();
    this.submitButton = page.locator('button[type="submit"]:has-text("Submit"), button:has-text("Submit Expense")');
  }

  async goto(): Promise<void> {
    await this.navigate("/reimbursements");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/reimbursements.*/);
    await expect(this.page.locator("body")).toContainText(/Reimbursement/i);
  }

  async submitClaim(amount: number, vendor: string = "Office Supplies Ltd", dateStr: string = "2026-08-20"): Promise<void> {
    await this.dateInput.fill(dateStr);
    await this.vendorInput.fill(vendor);
    await this.amountInput.fill(String(amount));
    await this.submitButton.click();
  }
}
