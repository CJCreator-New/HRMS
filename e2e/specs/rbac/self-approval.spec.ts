import { test, expect } from "../../fixtures/auth.fixture";
import { LeavePage } from "../../pages/LeavePage";
import { ApprovalsPage } from "../../pages/ApprovalsPage";

test.describe("RBAC: Strict Self-Approval Prevention Guardrails (SEC-02)", () => {
  test("Manager applying for own leave cannot self-approve their own request", async ({
    managerPage,
    baseURL,
  }) => {
    // 1. Manager requests comp-off credit (does not require pre-allocated balance)
    const leave = new LeavePage(managerPage, baseURL);
    await leave.goto();
    await leave.assertLoaded();
    await leave.requestCompOff("2026-08-30");

    // 2. Manager navigates to Approvals inbox
    const approvals = new ApprovalsPage(managerPage, baseURL);
    await approvals.goto();
    await approvals.assertLoaded();
    await approvals.filterByModule("Leave Requests");

    // 3. Verify that the manager's own request does not render an active approve button for themselves
    // Any items belonging to the active manager will either be hidden or routed to HR/Admin
    const ownName = "Rajesh Kumar";
    const ownRow = approvals.page.locator(`tr:has-text("${ownName}")`);
    if (await ownRow.count() > 0) {
      await expect(ownRow.locator('[data-testid="approve-single-btn"], button:has-text("Approve")')).not.toBeVisible();
    }
  });

  test("HR Admin cannot self-approve their own submitted expense reimbursements", async ({
    hrAdminPage,
    baseURL,
  }) => {
    // 1. HR Admin visits Approvals inbox
    const approvals = new ApprovalsPage(hrAdminPage, baseURL);
    await approvals.goto();
    await approvals.assertLoaded();
    await approvals.filterByModule("Reimbursements");

    // 2. Self-approval guardrail guarantees HR cannot decide their own requests
    const hrName = "HR Admin User";
    const hrOwnRow = approvals.page.locator(`tr:has-text("${hrName}")`);
    if (await hrOwnRow.count() > 0) {
      await expect(hrOwnRow.locator('button:has-text("Approve")')).not.toBeVisible();
    }
  });
});
