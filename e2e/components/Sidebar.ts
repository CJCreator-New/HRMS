import { Page, Locator, expect } from "@playwright/test";

export class SidebarComponent {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly closeMobileDrawerButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator("aside").first();
    this.closeMobileDrawerButton = page.locator('[data-testid="mobile-drawer"] button[aria-label="Close navigation menu"], button[aria-label="Close navigation menu"]').last();
  }

  getNavLink(routePath: string): Locator {
    const testId = routePath === "/" ? "nav-home" : `nav-${routePath.replace(/^\//, "").replace(/\//g, "-")}`;
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  async navigateTo(routePath: string): Promise<void> {
    const link = this.getNavLink(routePath);
    await expect(link).toBeVisible();
    await link.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async assertLinkActive(routePath: string): Promise<void> {
    const link = this.getNavLink(routePath);
    await expect(link).toHaveAttribute("aria-current", "page");
  }

  async closeMobileDrawer(): Promise<void> {
    if (await this.closeMobileDrawerButton.isVisible()) {
      await this.closeMobileDrawerButton.click();
    }
  }
}
