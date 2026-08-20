import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

/**
 * Suite 20 · FLW-03 — Offboarding / F&F lifecycle stepper
 * ------------------------------------------------------
 * Source: docs/DESIGN_FLOW_ENHANCEMENT_PLAN.md (WS-C §C2) ·
 *         docs/E2E_TEST_PLAN.md Suite 20
 *
 * ACTIVATED in Phase 2 — 5-step stepper mirroring the separation FSM shipped on
 * /offboarding (WS-C §C2). data-testid contract implemented by
 * src/components/shared/Stepper.tsx (`stepper` container, `stepper-step-N`).
 *
 * data-testid contract:
 *  - `data-testid="stepper"` + `data-testid="stepper-step-1"…"stepper-step-5"`
 *    (Resignation → Notice Period → Clearance → F&F Draft → Approval); active step has `aria-current="step"`
 *  - existing widgets preserved under their current testids:
 *    `submit-resignation-btn`, `clearance-matrix`, `clearance-<dept>-btn`, `approve-ff-btn`
 */
test.describe("Suite 20: Guided Workflows — Offboarding Stepper (FLW-03)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend (ADR 0004); skipped in offline mock mode."
    );
  });

  test("FLW-03: stepper guides resignation → clearance → F&F approval", async ({ hrAdminPage: page }) => {
    await page.goto("/offboarding");

    await expect(page.locator('[data-testid="stepper"]')).toBeVisible();
    for (let step = 1; step <= 5; step++) {
      await expect(page.locator(`[data-testid="stepper-step-${step}"]`)).toBeVisible();
    }

    // resignation step active initially
    await expect(page.locator('[data-testid="stepper-step-1"]')).toHaveAttribute("aria-current", "step");

    // initiate a resignation (form defaults: first employee, today, 30-day notice)
    await page.click('[data-testid="submit-resignation-btn"]');

    // workflow advances: clearance board and F&F approval surface in the detail board
    await expect(page.locator('[data-testid="clearance-matrix"]')).toBeVisible();
    await expect(page.locator('[data-testid="approve-ff-btn"]')).toBeVisible();
  });
});
