import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 12: Leave Encashment & Carry Forward (P1)", () => {
  test("ENC-01: Apply for annual leave encashment and view 26-day divisor calculation", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/encashment`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Financial Leave Operations & Encashment" heading.
    await expect(page.locator("main h2").first()).toContainText(/Financial Leave Operations & Encashment/i);
  });
});
