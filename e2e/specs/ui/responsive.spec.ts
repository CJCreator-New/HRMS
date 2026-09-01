import { test, expect } from "../../fixtures/auth.fixture";
import { HeaderComponent } from "../../components/Header";
import { SidebarComponent } from "../../components/Sidebar";

test.describe("UI Patterns: Responsive Multi-Viewport & Mobile Drawer", () => {
  test("Mobile viewport (375x667): Hamburger button toggles mobile navigation drawer", async ({
    sysAdminPage: page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState("domcontentloaded");

    const header = new HeaderComponent(page);
    const sidebar = new SidebarComponent(page);

    // In mobile viewport, hamburger button should be visible
    await expect(header.mobileMenuButton).toBeVisible();

    // Open mobile menu
    await header.openMobileMenu();

    // Drawer should become visible
    const mobileDrawer = page.locator('[data-testid="mobile-drawer"]');
    await expect(mobileDrawer).toBeVisible();

    // Close drawer
    await sidebar.closeMobileDrawer();
  });

  test("Tablet viewport (768x1024): Layout renders cleanly without body overflow", async ({
    hrAdminPage: page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${baseURL}/attendance`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("body")).toContainText(/Attendance/i);

    // Verify horizontal overflow containment: document width matches clientWidth
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
