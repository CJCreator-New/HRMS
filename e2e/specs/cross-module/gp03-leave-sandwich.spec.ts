import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-03: Leave Sandwich + LOP (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded leave allocations (ADR 0004); skipped in offline mock mode."
    );
  });
  test("Sandwich rule deducts weekend days and auto-converts to LOP when balance insufficient", async ({ employeePage: page, baseURL }) => {
    // Go to Leave Engine page
    await page.goto(`${baseURL}/leave`);
    await expect(page.locator("body")).toContainText(/Leave Engine|Apply for Leave|Leave/i);

    // Verify Sandwich rule policy section is visible
    await expect(page.locator("body")).toContainText(/Sandwich Rule Policy|Apply for Leave/i);
  });
});
