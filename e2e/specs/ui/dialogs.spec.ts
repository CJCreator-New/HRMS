import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

/**
 * Suite 20 · DIA-01…DIA-03 — Shared Modal focus trap, confirm dialogs, toasts
 * ---------------------------------------------------------------------------
 * Source: docs/DESIGN_FLOW_ENHANCEMENT_PLAN.md (WS-B) · H-11 / H-12 / UX-01 ·
 *         docs/E2E_TEST_PLAN.md Suite 20
 *
 * ACTIVE since Phase 0. Relies on this data-testid contract:
 *      - shared `Modal`:   `data-testid="modal"` container + `data-testid="modal-close"`
 *      - `ConfirmDialog`:  `data-testid="confirm-dialog"` + `confirm-dialog-confirm` / `confirm-dialog-cancel`
 *      - `Toast`:          `data-testid="toast"` with `role="status"` (aria-live),
 *                          variant `data-variant="success|error|info"`, close `data-testid="toast-close"`
 *                          (doc-close correction: variant is a data-variant attribute, not a
 *                          separate testid — see docs/DESIGN_FLOW_AUDIT_REPORT.md §6)
 *      - existing attendance testids preserved: `open-correction-modal-btn`, `reject-correction-btn`
 */
test.describe("Suite 20: UI Consistency — Dialogs, Confirmations & Toasts (DIA-01…03)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend (ADR 0004); skipped in offline mock mode."
    );
  });

  test("DIA-01: modal traps focus, closes on Escape, restores focus to trigger", async ({ employeePage: page }) => {
    await page.goto("/attendance");

    const trigger = page.locator('[data-testid="open-correction-modal-btn"]').first();
    await trigger.click();

    const modal = page.locator('[data-testid="modal"]');
    await expect(modal).toBeVisible();

    // Tab repeatedly — focus must never escape the dialog
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      await expect(
        page.evaluate(() => document.activeElement?.closest('[data-testid="modal"]') !== null)
      ).resolves.toBe(true);
    }

    // Escape dismisses and returns focus to the trigger
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("DIA-02: destructive reject action requires explicit confirmation (cancel is a no-op)", async ({
    managerPage: page,
  }) => {
    await page.goto("/attendance");

    await page.locator('[data-testid="reject-correction-btn"]').first().click();

    const dialog = page.locator('[data-testid="confirm-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Are you sure/i);

    await dialog.locator('[data-testid="confirm-dialog-cancel"]').click();
    await expect(dialog).toBeHidden();

    // nothing was rejected — no error toast was emitted
    await expect(page.locator('[data-variant="error"]')).toHaveCount(0);
  });

  test("DIA-03: toast announces via aria-live and is manually dismissible", async ({ employeePage: page }) => {
    await page.goto("/leave");

    await page.fill('[data-testid="start-date-input"]', "2026-10-01");
    await page.fill('[data-testid="end-date-input"]', "2026-10-02");
    await page.fill('[data-testid="leave-reason-input"]', "Scaffold toast verification");
    await page.click('[data-testid="submit-leave-btn"]');

    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("role", "status");

    await toast.locator('[data-testid="toast-close"]').click();
    await expect(toast).toBeHidden();
  });
});
