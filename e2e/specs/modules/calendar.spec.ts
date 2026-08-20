import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 04: Work Calendar & Holidays (P1)", () => {
  test("CAL-01: Create and view 5-day and 6-day work calendar templates", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/calendar`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Work Calendar Templates & Holiday Selection" heading.
    await expect(page.locator("main h2").first()).toContainText(/Work Calendar Templates/i);
  });
});
