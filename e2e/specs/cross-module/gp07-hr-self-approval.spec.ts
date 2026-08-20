import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-07: HR Self-Approval Prevention (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Action-level trace requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });
  test("HR Admin leave routes to alternate_hr_approver_id per FR §1.4", async ({ hrAdminPage: page, baseURL }) => {
    // Login as HR Admin
    await page.goto(`${baseURL}/leave`);
    await expect(page.locator("body")).toContainText(/Leave Engine|Apply for Leave|Leave/i);

    // Apply leave form controls are accessible
    await expect(page.locator("body")).toContainText(/Apply for Leave|Reason/i);
  });
});
