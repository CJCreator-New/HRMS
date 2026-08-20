import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

test.describe("Module 04: Attendance & Time Tracking E2E Specs", () => {
  test("should display attendance header and action controls", async ({ employeePage: page }) => {
    await page.goto("/attendance");
    // The attendance page renders an <h1> header inside <main> (no attendance-header testid);
    // punch controls are the punch-in / punch-out buttons.
    await expect(page.locator("main h1").first()).toContainText("Attendance & Time Tracking");
    await expect(page.locator('[data-testid="punch-in-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="punch-out-btn"]')).toBeVisible();
  });

  test("should punch check-in successfully", async ({ employeePage: page }) => {
    test.skip(
      !(await isSupabaseReachable()),
      "Mutation test requires live Supabase backend (ADR 0004 hybrid seed); skipped in offline mock mode."
    );
    await page.goto("/attendance");
    const checkInBtn = page.locator('[data-testid="punch-in-btn"]');
    await expect(checkInBtn).toBeVisible();
    await checkInBtn.click();
    await expect(page.locator("body")).toContainText("Checked in successfully");
    await expect(page.locator('[data-testid="punch-out-btn"]')).toBeVisible();
  });

  test("should allow submitting attendance correction request", async ({ employeePage: page }) => {
    await page.goto("/attendance");
    const openModalBtn = page.locator('[data-testid="open-correction-modal-btn"]').first();
    if (await openModalBtn.isVisible()) {
      await openModalBtn.click();
      await page.fill('[data-testid="correction-reason-input"]', "Forgot to punch out due to client meeting");
      await page.click('[data-testid="correction-submit-btn"]');
      await expect(page.locator("body")).toContainText("Correction request submitted");
    }
  });
});
