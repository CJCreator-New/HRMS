import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Module 06: Short Permission Requests (P1)", () => {
  test("PRM-01: Apply for short permission request with 2-hour max validation", async ({ employeePage: page, baseURL }) => {
    test.skip(
      !(await isSupabaseReachable()),
      "Mutation test requires live Supabase backend (ADR 0004 hybrid seed); skipped in offline mock mode."
    );
    await page.goto(`${baseURL}/permissions`);
    await expect(page.locator('[data-testid="permissions-header"]')).toBeVisible();

    // Fill short permission form
    await page.fill('[data-testid="permission-date-input"]', "2026-08-20");
    await page.fill('[data-testid="permission-start-time-input"]', "10:00");
    await page.fill('[data-testid="permission-end-time-input"]', "11:30");
    await page.fill('[data-testid="permission-reason-input"]', "Doctor appointment");

    await page.click('[data-testid="permission-submit-btn"]');
    await expect(page.locator("body")).toContainText(/Short permission request submitted|Pending manager approval/i);
  });
});
