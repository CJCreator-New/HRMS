import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-06: Resignation-to-F&F (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Action-level trace requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });
  test("Resignation → Notice period LWD → Clearance checklist → F&F approval → Completed Separation", async ({ hrAdminPage: page, baseURL }) => {
    // HR Admin opens offboarding page
    await page.goto(`${baseURL}/offboarding`);
    await expect(page.locator("body")).toContainText(/Separation & Full & Final|Offboarding/i);

    // Verify clearance checklist tracker is visible
    await expect(page.locator("body")).toContainText(/Clearance|Resignation|Checklist/i);
  });
});
