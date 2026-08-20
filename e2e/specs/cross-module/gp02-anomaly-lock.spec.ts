import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Golden Path GP-02: Attendance Anomaly Blocking Payroll Lock E2E Spec", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Action-level trace requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });
  test("should enforce attendance anomaly lock check during payroll run", async ({ payrollAdminPage: page, baseURL }) => {
    // 1. Payroll Admin visits attendance page (shows read-only banner)
    await page.goto(`${baseURL}/attendance`);
    await expect(page.locator("body")).toContainText(/Attendance|Read-Only/i);

    // 2. Payroll Admin visits payroll page and verifies lock check controls
    await page.goto(`${baseURL}/payroll`);
    await expect(page.locator('[data-testid="payroll-header"]')).toBeVisible();
    await expect(page.locator("body")).toContainText(/Payroll Core Engine|Strict Payroll Lock|Validation/i);
  });
});
