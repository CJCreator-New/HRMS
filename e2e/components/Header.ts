import { Page, Locator, expect } from "@playwright/test";

export class HeaderComponent {
  readonly page: Page;
  readonly header: Locator;
  readonly roleSwitcher: Locator;
  readonly roleSwitcherSelect: Locator;
  readonly mobileMenuButton: Locator;
  readonly logoutButton: Locator;
  readonly searchTrigger: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator("header").first();
    this.roleSwitcher = page.locator('[data-testid="role-switcher"]');
    this.roleSwitcherSelect = page.locator('[data-testid="role-switcher-select"]');
    this.mobileMenuButton = page.locator('button[aria-label="Open navigation menu"]');
    this.logoutButton = page.locator('button[aria-label="Sign out of system"]');
    this.searchTrigger = page.locator('[data-testid="search-palette-trigger"], button:has-text("Search"), button:has-text("⌘K"), button:has-text("Ctrl+K")').first();
  }

  async switchRole(roleCode: string): Promise<void> {
    await expect(this.roleSwitcherSelect).toBeVisible();
    await this.roleSwitcherSelect.selectOption(roleCode);
  }

  async openMobileMenu(): Promise<void> {
    await this.mobileMenuButton.click();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
    await this.page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 8000 });
  }
}
