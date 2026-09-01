import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class LeavePage extends BasePage {
  readonly leaveTypeSelect: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly reasonInput: Locator;
  readonly submitButton: Locator;
  readonly compoffDateInput: Locator;
  readonly submitCompoffButton: Locator;
  readonly approveButtons: Locator;
  readonly rejectButtons: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.leaveTypeSelect = page.locator('[data-testid="leave-type-select"], select#leaveTypeSelect');
    this.startDateInput = page.locator('[data-testid="start-date-input"], input#startDateInput');
    this.endDateInput = page.locator('[data-testid="end-date-input"], input#endDateInput');
    this.reasonInput = page.locator('[data-testid="leave-reason-input"], textarea#leaveReasonInput');
    this.submitButton = page.locator('[data-testid="submit-leave-btn"]');
    this.compoffDateInput = page.locator('[data-testid="compoff-date-input"], input#extraWorkDateInput');
    this.submitCompoffButton = page.locator('[data-testid="submit-compoff-btn"]');
    this.approveButtons = page.locator('[data-testid="approve-leave-btn"], button:has-text("Approve")');
    this.rejectButtons = page.locator('[data-testid="reject-leave-btn"], button:has-text("Reject")');
  }

  async goto(): Promise<void> {
    await this.navigate("/leave");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/leave.*/);
    await expect(this.page.locator("body")).toContainText(/Leave/i);
  }

  async applyLeave(startDate: string, endDate: string, reason: string = "Personal work", typeCode: string = "CL"): Promise<void> {
    const optionCount = await this.leaveTypeSelect.locator("option").count();
    if (optionCount > 0) {
      await this.leaveTypeSelect.selectOption({ value: typeCode }).catch(() => {
        return this.leaveTypeSelect.selectOption({ index: 0 }).catch(() => {});
      });
    }
    if (await this.startDateInput.isVisible()) {
      await this.startDateInput.fill(startDate);
      await this.endDateInput.fill(endDate);
      await this.reasonInput.fill(reason);
      await this.submitButton.click();
    }
  }

  async requestCompOff(extraWorkDate: string): Promise<void> {
    if (await this.compoffDateInput.isVisible()) {
      await this.compoffDateInput.fill(extraWorkDate);
      await this.submitCompoffButton.click();
    }
  }

  async requestCompoff(dateStr: string): Promise<void> {
    await this.compoffDateInput.fill(dateStr);
    await this.submitCompoffButton.click();
  }
}
