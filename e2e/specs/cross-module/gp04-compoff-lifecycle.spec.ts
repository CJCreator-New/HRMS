import { test, expect } from "../../fixtures/auth.fixture";
import { LeavePage } from "../../pages/LeavePage";
import { ApprovalsPage } from "../../pages/ApprovalsPage";
import { PermissionsPage } from "../../pages/PermissionsPage";

test.describe("Cross-Module Golden Path GP-04: Comp-Off Lifecycle (P1)", () => {
  test("Comp-off request → Manager Approvals inbox → Quota tracking", async ({
    employeePage,
    managerPage,
    baseURL,
  }) => {
    // 1. Employee requests 1-day comp-off on leave page
    const leave = new LeavePage(employeePage, baseURL);
    await leave.goto();
    await leave.assertLoaded();
    await leave.requestCompoff("2026-08-16");

    // 2. Manager reviews Comp-Off grant in Approvals
    const approvals = new ApprovalsPage(managerPage, baseURL);
    await approvals.goto();
    await approvals.assertLoaded();
    await approvals.filterByModule("Comp-Off Grants");

    // 3. Employee checks Permissions & Quotas
    const permissions = new PermissionsPage(employeePage, baseURL);
    await permissions.goto();
    await permissions.assertLoaded();
  });
});
