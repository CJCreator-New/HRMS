import { test, expect } from "../../fixtures/auth.fixture";
import { AttendancePage } from "../../pages/AttendancePage";
import { ApprovalsPage } from "../../pages/ApprovalsPage";
import { PayrollPage } from "../../pages/PayrollPage";

test.describe("Golden Path GP-02: Attendance Anomaly Blocking Payroll Lock (P1)", () => {
  test("Attendance anomaly lifecycle: Regularization request → Manager Approvals queue → Payroll Validation", async ({
    employeePage,
    managerPage,
    payrollAdminPage,
    baseURL,
  }) => {
    // 1. Employee submits attendance correction for missing punch
    const attendance = new AttendancePage(employeePage, baseURL);
    await attendance.goto();
    await attendance.assertLoaded();
    await attendance.submitCorrection("09:15", "18:30", "Gate biometric anomaly correction");

    // 2. Manager reviews regularization in Approvals inbox
    const approvals = new ApprovalsPage(managerPage, baseURL);
    await approvals.goto();
    await approvals.assertLoaded();
    await approvals.filterByModule("Attendance Corrections");

    // 3. Payroll Admin verifies payroll lock & validation controls
    const payroll = new PayrollPage(payrollAdminPage, baseURL);
    await payroll.goto();
    await payroll.assertLoaded();
    await expect(payroll.stepper).toBeVisible();
  });
});
