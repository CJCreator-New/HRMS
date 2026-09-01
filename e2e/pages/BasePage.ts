import { Page, Locator, expect } from "@playwright/test";
import { HeaderComponent } from "../components/Header";
import { SidebarComponent } from "../components/Sidebar";

export class BasePage {
  readonly page: Page;
  readonly baseURL: string;
  readonly header: HeaderComponent;
  readonly sidebar: SidebarComponent;

  constructor(page: Page, baseURL?: string) {
    this.page = page;
    this.baseURL = (baseURL || "").replace(/\/$/, "");
    this.header = new HeaderComponent(page);
    this.sidebar = new SidebarComponent(page);
  }

  async navigate(path: string = "/"): Promise<void> {
    const target = path.startsWith("/") ? `${this.baseURL}${path}` : `${this.baseURL}/${path}`;
    await this.page.goto(target);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  async assertToastMessage(textMatch: string | RegExp): Promise<void> {
    const toast = this.page.locator('[data-testid="toast"], [role="status"], [role="alert"]').first();
    await expect(toast).toBeVisible({ timeout: 8000 });
    await expect(toast).toContainText(textMatch);
  }

  async assertHeading(titleMatch: string | RegExp): Promise<void> {
    const heading = this.page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(titleMatch);
  }
}
