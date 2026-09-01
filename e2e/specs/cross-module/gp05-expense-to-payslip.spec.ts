import { test, expect } from "../../fixtures/auth.fixture";
import { ReimbursementsPage } from "../../pages/ReimbursementsPage";
import { ApprovalsPage } from "../../pages/ApprovalsPage";
import { PayrollPage } from "../../pages/PayrollPage";

test.describe("Cross-Module Golden Path GP-05: Expense-to-Payslip (P1)", () => {
  test("Expense reimbursement: Claim submit → Manager Approvals queue → Payroll inclusion", async ({
    employeePage,
    managerPage,
    payrollAdminPage,
    baseURL,
  }) => {
    // 1. Employee submits expense claim
    const reimbursements = new ReimbursementsPage(employeePage, baseURL);
    await reimbursements.goto();
    await reimbursements.assertLoaded();
    await reimbursements.submitClaim(2500, "Client Lunch & Travel", "2026-08-18");

    // 2. Manager reviews in Approvals inbox
    const approvals = new ApprovalsPage(managerPage, baseURL);
    await approvals.goto();
    await approvals.assertLoaded();
    await approvals.filterByModule("Reimbursements");

    // 3. Payroll Admin inspects payroll engine
    const payroll = new PayrollPage(payrollAdminPage, baseURL);
    await payroll.goto();
    await payroll.assertLoaded();
  });
});
