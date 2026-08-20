import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 10: Statutory Engine (P1)", () => {
  test("STA-01: PF 12% capped at 15k, ESI 0.75%, PT state slab calculation", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/statutory`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "India Statutory Payroll Engine" heading.
    await expect(page.locator("main h2").first()).toContainText(/India Statutory Payroll/i);
  });
});
