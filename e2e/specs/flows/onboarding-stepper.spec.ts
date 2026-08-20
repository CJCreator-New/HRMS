import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

/**
 * Suite 20 · FLW-04 — Two-step direct onboarding flow (ADR 0001)
 * --------------------------------------------------------------
 * Source: docs/DESIGN_FLOW_ENHANCEMENT_PLAN.md (WS-C §C3) ·
 *         docs/E2E_TEST_PLAN.md Suite 20
 *
 * ACTIVATED in Phase 2 — two-step onboarding flow shipped on /onboarding (WS-C §C3).
 * data-testid contract implemented by src/app/onboarding/page.tsx + Stepper.tsx.
 *
 * data-testid contract:
 *  - `data-testid="stepper"` + `data-testid="stepper-step-1"` / `stepper-step-2`
 *  - `data-testid="onboarding-next-btn"`     (step 1 → step 2)
 *  - `data-testid="onboarding-confirm-btn"`  (step 2 submit)
 *  - existing field testids preserved: `onboarding-emp-code`, `onboarding-full-name`,
 *    `onboarding-email`, `onboarding-doj`, `onboarding-temp-pass`
 */
test.describe("Suite 20: Guided Workflows — Onboarding 2-Step (FLW-04)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend (ADR 0004); skipped in offline mock mode."
    );
  });

  test("FLW-04: two-step onboarding flow creates an invited employee", async ({ hrAdminPage: page }) => {
    const uniqueEmail = `e2e.scaffold.${Date.now()}@company.com`;

    await page.goto("/onboarding");

    await expect(page.locator('[data-testid="stepper"]')).toBeVisible();
    await expect(page.locator('[data-testid="stepper-step-1"]')).toHaveAttribute("aria-current", "step");

    // Step 1 — Identity & Org Assignment
    await page.fill('[data-testid="onboarding-emp-code"]', "EMP-E2E-DFLOW");
    await page.fill('[data-testid="onboarding-full-name"]', "E2E Scaffold User");
    await page.fill('[data-testid="onboarding-email"]', uniqueEmail);
    await page.fill('[data-testid="onboarding-doj"]', "2026-08-14");
    await page.click('[data-testid="onboarding-next-btn"]');

    // Step 2 — Credentials Review & Confirm
    await expect(page.locator('[data-testid="stepper-step-2"]')).toHaveAttribute("aria-current", "step");
    await page.click('[data-testid="onboarding-confirm-btn"]');

    await expect(page.locator("body")).toContainText(/Onboarding Record Created/i);
  });
});
