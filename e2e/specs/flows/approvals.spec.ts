import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

/**
 * Suite 20 · APP-01…APP-02 — Approvals detail drawer + batch approve (F-03/F-04)
 * -------------------------------------------------------------------------------
 * Source: docs/DESIGN_FLOW_ENHANCEMENT_PLAN.md (WS-C §C4) · docs/E2E_TEST_PLAN.md Suite 20
 *
 * ACTIVATED in Phase 3 — read-only detail drawer with Approve/Reject living in
 * the drawer, plus checkbox batch approve mapped to decideApprovalAction.
 *
 * data-testid contract:
 *  - `data-testid="view-approval-btn"`            row "View" action opens the drawer
 *  - `data-testid="drawer"` / `drawer-close`       shared Drawer container / close
 *  - `data-testid="approval-detail-fields"`        normalized label/value detail list
 *  - `data-testid="approve-in-drawer-btn"` / `reject-in-drawer-btn`  footer decisions
 *  - `data-testid="select-approval-<id>"`          per-row checkbox
 *  - `data-testid="select-all-approvals"`          "select all on page" checkbox
 *  - `data-testid="approve-selected-btn"`          batch action (disabled until ≥1 selected)
 *
 * NOTE: live-backend only (ADR 0004). APP-02 approves ONE row to keep the
 * seeded dataset intact.
 */
test.describe("Suite 20: Guided Workflows — Approvals Detail & Batch (APP-01, APP-02)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded pending approvals (ADR 0004); skipped in offline mock mode."
    );
  });

  test("APP-01: View opens the read-only detail drawer with Approve/Reject in the drawer", async ({
    managerPage: page,
  }) => {
    await page.goto("/approvals");

    await expect(page.locator('[data-testid="approvals-table"]')).toBeVisible();
    const viewBtn = page.locator('[data-testid="view-approval-btn"]').first();
    await viewBtn.click();

    const drawer = page.locator('[data-testid="drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-testid="approval-detail-fields"]')).toBeVisible();

    const approveBtn = drawer.locator('[data-testid="approve-in-drawer-btn"]');
    const rejectBtn = drawer.locator('[data-testid="reject-in-drawer-btn"]');

    if (await approveBtn.isVisible()) {
      // The acting manager can decide this module — approve from the drawer.
      await expect(rejectBtn).toBeVisible();
      await approveBtn.click();
      await expect(page.locator('[data-testid="toast"]').first()).toBeVisible();
      await expect(drawer).toBeHidden();
    } else {
      // Read-only for this actor's module — the drawer still closes cleanly.
      await drawer.locator('[data-testid="drawer-close"]').click();
      await expect(drawer).toBeHidden();
    }
  });

  test("APP-02: batch select + Approve Selected decides one row and toasts", async ({
    managerPage: page,
  }) => {
    await page.goto("/approvals");

    await expect(page.locator('[data-testid="approvals-table"]')).toBeVisible();

    const firstCheckbox = page.locator('[data-testid^="select-approval-"]').first();
    await firstCheckbox.check();

    const batchBtn = page.locator('[data-testid="approve-selected-btn"]');
    await expect(batchBtn).toBeEnabled();
    await expect(batchBtn).toContainText("Approve Selected (1)");

    await batchBtn.click();
    await expect(page.locator('[data-testid="toast"]').first()).toBeVisible();

    // Selection clears after the batch run, disabling the button again.
    await expect(batchBtn).toBeDisabled();
  });
});
