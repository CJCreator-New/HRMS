import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class DashboardPage extends BasePage {
  readonly greeting: Locator;
  readonly nextActions: Locator;
  readonly punchCard: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.greeting = page.locator('[data-testid="dashboard-greeting"], h2:has-text("Welcome"), h2:has-text("Focus")').first();
    this.nextActions = page.locator('[data-testid="next-actions"]');
    this.punchCard = page.locator('[data-testid="punch-card"], [data-testid="punch-in-btn"]').first();
  }

  async goto(): Promise<void> {
    await this.navigate("/");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${this.baseURL}/?$`));
    await expect(this.greeting).toBeVisible({ timeout: 10000 });
  }

  async clickNextAction(actionLabel: string | RegExp): Promise<void> {
    const action = this.page.locator(`[data-testid="next-actions"] a:has-text("${actionLabel}")`).first();
    await expect(action).toBeVisible();
    await action.click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
