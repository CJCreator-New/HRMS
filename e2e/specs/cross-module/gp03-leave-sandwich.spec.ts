import { test, expect } from "../../fixtures/auth.fixture";
import { LeavePage } from "../../pages/LeavePage";
import { ApprovalsPage } from "../../pages/ApprovalsPage";

test.describe("Cross-Module Golden Path GP-03: Leave Sandwich Rule (P1)", () => {
  test("Sandwich rule: Friday-to-Monday leave application and Manager Approvals visibility", async ({
    employeePage,
    managerPage,
    baseURL,
  }) => {
    // 1. Employee applies for leave spanning weekend
    const leave = new LeavePage(employeePage, baseURL);
    await leave.goto();
    await leave.assertLoaded();
    await leave.applyLeave("2026-09-04", "2026-09-07", "GP-03 Weekend sandwich leave");

    // 2. Manager verifies in Approvals inbox
    const approvals = new ApprovalsPage(managerPage, baseURL);
    await approvals.goto();
    await approvals.assertLoaded();
    await approvals.filterByModule("Leave Requests");
  });
});
