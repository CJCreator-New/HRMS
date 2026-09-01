import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class PayrollPage extends BasePage {
  readonly header: Locator;
  readonly stepper: Locator;
  readonly runPayrollButton: Locator;
  readonly finalizePayrollButton: Locator;
  readonly reopenPayrollButton: Locator;
  readonly viewPayslipButtons: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.header = page.locator('[data-testid="payroll-header"]');
    this.stepper = page.locator('[data-testid="stepper"], [data-testid="payroll-stepper"]');
    this.runPayrollButton = page.locator('[data-testid="run-payroll-btn"]');
    this.finalizePayrollButton = page.locator('[data-testid="finalize-payroll-btn"]');
    this.reopenPayrollButton = page.locator('[data-testid="reopen-payroll-btn"]');
    this.viewPayslipButtons = page.locator('[data-testid="view-payslip-btn"]');
  }

  async goto(): Promise<void> {
    await this.navigate("/payroll");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/payroll.*/);
    await expect(this.page.locator("body")).toContainText(/Payroll/i);
  }

  async runPayrollCycle(): Promise<void> {
    if (await this.runPayrollButton.isVisible()) {
      await this.runPayrollButton.click();
    }
  }

  async finalizePayroll(): Promise<void> {
    if (await this.finalizePayrollButton.isVisible()) {
      await this.finalizePayrollButton.click();
    }
  }
}
