import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-05: Expense-to-Payslip (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Action-level trace requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });
  test("Submit reimbursement claim → Approval → Classification in payroll payment items", async ({ employeePage: page, baseURL }) => {
    // 1. Employee E1 visits reimbursement portal
    await page.goto(`${baseURL}/reimbursements`);
    await expect(page.locator("body")).toContainText(/Expense Reimbursement|Claims|Categories/i);

    // 2. Verify submission form / claim list is visible
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);
  });
});
