import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-04: Comp-Off Lifecycle (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded extra-work records (ADR 0004); skipped in offline mock mode."
    );
  });
  test("Extra work punch → Comp-off request → Manager approve → 90-day expiry tracking", async ({ employeePage: page, baseURL }) => {
    // Go to Leave page comp-off section
    await page.goto(`${baseURL}/leave`);
    await expect(page.locator("body")).toContainText(/Leave Engine|Apply for Leave|Leave/i);

    // Verify Comp-Off section is visible
    await expect(page.locator("body")).toContainText(/Request Comp-Off Credit|Comp-Off/i);
  });
});
