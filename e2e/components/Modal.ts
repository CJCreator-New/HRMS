import { Page, Locator, expect } from "@playwright/test";

export class ModalComponent {
  readonly page: Page;
  readonly modal: Locator;
  readonly closeButton: Locator;
  readonly title: Locator;

  constructor(page: Page, testId: string = "modal") {
    this.page = page;
    this.modal = page.locator(`[data-testid="${testId}"]`);
    this.closeButton = this.modal.locator('button[aria-label="Close dialog"], [data-testid="modal-close"]').first();
    this.title = this.modal.locator("h2, h3").first();
  }

  async assertOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }

  async assertClosed(): Promise<void> {
    await expect(this.modal).not.toBeVisible();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await this.assertClosed();
  }

  async dismissViaEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.assertClosed();
  }
}
