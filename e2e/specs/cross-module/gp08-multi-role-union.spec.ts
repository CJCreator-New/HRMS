import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Cross-Module Golden Path GP-08: Multi-Role Cumulative Union (P1)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Action-level trace requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });
  test("User with hr + manager roles holds cumulative union of permissions regardless of switcher label", async ({ loginAs, baseURL }) => {
    // Login as Multi-Role User (multi_hr_mgr)
    const page = await loginAs("multi_hr_mgr");

    // Both /onboarding (hr) and /approvals (manager) should be accessible
    await page.goto(`${baseURL}/onboarding`);
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);

    await page.goto(`${baseURL}/approvals`);
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);
  });
});
