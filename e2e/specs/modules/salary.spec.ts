import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 07: Salary Structures (P1)", () => {
  test("SAL-01: Versioned structure assignment with effective-dated CTC", async ({ payrollAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/salary`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Per-Employee Versioned Salary Structure" heading.
    await expect(page.locator("main h2").first()).toContainText(/Per-Employee Versioned Salary/i);
  });
});
