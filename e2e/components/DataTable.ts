import { Page, Locator, expect } from "@playwright/test";

export class DataTableComponent {
  readonly page: Page;
  readonly tableWrapper: Locator;
  readonly pagination: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;
  readonly sizeSelect: Locator;
  readonly pageLabel: Locator;

  constructor(page: Page, tableName?: string) {
    this.page = page;
    this.tableWrapper = tableName
      ? page.locator(`[data-testid="${tableName}-table"]`)
      : page.locator('table, [data-testid$="-table"]').first();
    this.pagination = page.locator('[data-testid="pagination"]');
    this.prevButton = page.locator('[data-testid="pagination-prev"]');
    this.nextButton = page.locator('[data-testid="pagination-next"]');
    this.sizeSelect = page.locator('[data-testid="pagination-size"]');
    this.pageLabel = page.locator('[data-testid="pagination-page"]');
  }

  async getRowCount(): Promise<number> {
    return await this.tableWrapper.locator("tbody tr").count();
  }

  async sortBy(columnKey: string): Promise<void> {
    const header = this.tableWrapper.locator(`[data-testid="sort-${columnKey}"]`);
    await expect(header).toBeVisible();
    await header.click();
  }

  async setPageSize(size: number): Promise<void> {
    await expect(this.sizeSelect).toBeVisible();
    await this.sizeSelect.selectOption(String(size));
  }

  async goToNextPage(): Promise<void> {
    await expect(this.nextButton).toBeEnabled();
    await this.nextButton.click();
  }

  async goToPrevPage(): Promise<void> {
    await expect(this.prevButton).toBeEnabled();
    await this.prevButton.click();
  }

  async assertPageLabelContains(text: string): Promise<void> {
    await expect(this.pageLabel).toContainText(text);
  }
}
