import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ApprovalsPage extends BasePage {
  readonly pendingCountBadge: Locator;
  readonly selectAllCheckbox: Locator;
  readonly batchApproveButton: Locator;
  readonly viewDetailButtons: Locator;
  readonly drawer: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.pendingCountBadge = page.locator('span:has-text("Pending Action")').first();
    this.selectAllCheckbox = page.locator('[data-testid="select-all-approvals"]');
    this.batchApproveButton = page.locator('[data-testid="batch-approve-btn"], button:has-text("Batch Approve")').first();
    this.viewDetailButtons = page.locator('[data-testid="view-approval-btn"]');
    this.drawer = page.locator('[data-testid="drawer"]');
  }

  async goto(): Promise<void> {
    await this.navigate("/approvals");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/approvals.*/);
    await expect(this.page.locator("body")).toContainText(/Approvals/i);
  }

  async filterByModule(moduleLabel: string): Promise<void> {
    const chip = this.page.locator(`button:has-text("${moduleLabel}")`).first();
    await expect(chip).toBeVisible();
    await chip.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openFirstDetailDrawer(): Promise<void> {
    const firstBtn = this.viewDetailButtons.first();
    await expect(firstBtn).toBeVisible();
    await firstBtn.click();
    await expect(this.drawer).toBeVisible();
  }

  async approveFirstItem(): Promise<void> {
    const btn = this.page.locator('[data-testid="approve-single-btn"], button:has-text("Approve")').first();
    await expect(btn).toBeVisible();
    await btn.click();
  }

  async rejectFirstItem(reason: string = "Policy deviation"): Promise<void> {
    const btn = this.page.locator('[data-testid="reject-single-btn"], button:has-text("Reject")').first();
    await expect(btn).toBeVisible();
    await btn.click();
    const reasonBox = this.page.locator('textarea, input[placeholder*="reason" i]').first();
    if (await reasonBox.isVisible()) {
      await reasonBox.fill(reason);
      await this.page.locator('button:has-text("Confirm Reject"), button:has-text("Reject")').last().click();
    }
  }
}
