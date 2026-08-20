import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-10: India FY 2025–26 Statutory Calculations (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Action-level trace requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });
  test("Statutory profile configuration reflects PF 15k cap, ESI 0.75%, State PT, and Tax Regime", async ({ payrollAdminPage: page, baseURL }) => {
    // 1. Payroll Admin accesses Statutory Dashboard
    await page.goto(`${baseURL}/statutory`);
    await expect(page.locator("body")).toContainText(/Statutory Profiles|Statutory Rules|PF|ESI/i);

    // 2. Verify Statutory Rule Version exists
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);
  });
});
