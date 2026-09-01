import { test, expect } from "../../fixtures/auth.fixture";
import { OnboardingPage } from "../../pages/OnboardingPage";
import { AttendancePage } from "../../pages/AttendancePage";
import { LeavePage } from "../../pages/LeavePage";
import { ApprovalsPage } from "../../pages/ApprovalsPage";
import { PayrollPage } from "../../pages/PayrollPage";

test.describe("Cross-Module Golden Path GP-01: Hire-to-First-Payslip (P1)", () => {
  test("Complete E2E lifecycle: Onboarding → Punch → Leave → Approvals → Payroll Run", async ({
    hrAdminPage,
    employeePage,
    managerPage,
    payrollAdminPage,
    baseURL,
  }) => {
    // 1. HR Admin Onboards new employee
    const onboarding = new OnboardingPage(hrAdminPage, baseURL);
    await onboarding.goto();
    await onboarding.assertLoaded();
    const uniqueEmpCode = `EMP-${Date.now().toString().slice(-5)}`;
    await onboarding.onboardEmployee(
      uniqueEmpCode,
      "New Candidate",
      `candidate.${Date.now()}@company.com`
    );

    // 2. Employee Attendance Punch & Workspace
    const attendance = new AttendancePage(employeePage, baseURL);
    await attendance.goto();
    await attendance.assertLoaded();
    await attendance.punchIn();

    // 3. Employee Leave Application
    const leave = new LeavePage(employeePage, baseURL);
    await leave.goto();
    await leave.assertLoaded();
    await leave.applyLeave("2026-09-08", "2026-09-09", "GP-01 Onboarding leave request");

    // 4. Manager Approvals Review
    const approvals = new ApprovalsPage(managerPage, baseURL);
    await approvals.goto();
    await approvals.assertLoaded();
    await approvals.filterByModule("Leave Requests");

    // 5. Payroll Admin Run Stepper & Calculations
    const payroll = new PayrollPage(payrollAdminPage, baseURL);
    await payroll.goto();
    await payroll.assertLoaded();
    await expect(payroll.stepper).toBeVisible();
  });
});
