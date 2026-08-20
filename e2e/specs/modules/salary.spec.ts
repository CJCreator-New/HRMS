import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 07: Salary Structures (P1)", () => {
  test("SAL-01: Versioned structure assignment with effective-dated CTC", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/salary`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Per-Employee Versioned Salary Structure" heading.
    await expect(page.locator("main h2").first()).toContainText(/Per-Employee Versioned Salary/i);
  });

  test("SAL-02: Batch upload drawer trigger and template download are available", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/salary`);
    const batchBtn = page.getByRole("button", { name: /Batch Upload/i });
    await expect(batchBtn).toBeVisible();
    await batchBtn.click();
    await expect(page.getByText(/Batch Upload: Salary Structure Versions/i)).toBeVisible();
    await expect(page.getByText(/Download Template/i)).toBeVisible();
  });
});
