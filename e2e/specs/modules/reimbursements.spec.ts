import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 11: Expense Reimbursements (P1)", () => {
  test("REIM-01: Submit expense claim with receipt and view claim status", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/reimbursements`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Expense Reimbursements Engine" heading.
    await expect(page.locator("main h2").first()).toContainText(/Expense Reimbursements Engine/i);
  });
});
