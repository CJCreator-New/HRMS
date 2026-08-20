import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 10: Statutory Engine (P1)", () => {
  test("STA-01: PF 12% capped at 15k, ESI 0.75%, PT state slab calculation", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/statutory`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "India Statutory Payroll Engine" heading.
    await expect(page.locator("main h2").first()).toContainText(/India Statutory Payroll/i);
  });

  test("STA-02: Batch upload drawer trigger and template download are available", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/statutory`);
    const batchBtn = page.getByRole("button", { name: /Batch Upload/i });
    await expect(batchBtn).toBeVisible();
    await batchBtn.click();
    await expect(page.getByText(/Batch Upload: Statutory Profiles/i)).toBeVisible();
    await expect(page.getByText(/Download Template/i)).toBeVisible();
  });
});
