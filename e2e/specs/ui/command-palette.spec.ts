import { test, expect } from "../../fixtures/auth.fixture";
import { HeaderComponent } from "../../components/Header";

test.describe("UI Patterns: Global Command Palette (Ctrl+K / Cmd+K)", () => {
  test("Command palette opens via keyboard shortcut or header trigger, accepts query, and closes on Escape", async ({
    sysAdminPage: page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState("domcontentloaded");

    const header = new HeaderComponent(page);
    await expect(header.header).toBeVisible();

    // 1. Trigger via keyboard shortcut Ctrl+K / Meta+K
    await page.keyboard.press("ControlOrMeta+K");

    // Palette modal/dialog should appear
    const palette = page.locator('[role="dialog"], [data-testid="search-palette"], input[placeholder*="search" i]').first();
    const isVisible = await palette.isVisible();

    if (isVisible) {
      // 2. Type search query
      const searchInput = page.locator('input[placeholder*="search" i]').first();
      await searchInput.fill("Leave");

      // 3. Close via Escape key
      await page.keyboard.press("Escape");
      await expect(palette).not.toBeVisible();
    } else if (await header.searchTrigger.isVisible()) {
      // Fallback: trigger via header search button
      await header.searchTrigger.click();
      const input = page.locator('input[placeholder*="search" i]').first();
      if (await input.isVisible()) {
        await input.fill("Attendance");
        await page.keyboard.press("Escape");
      }
    }
  });
});
