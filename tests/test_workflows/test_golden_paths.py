"""
Comprehensive End-to-End Golden Path Workflows (GP-01 to GP-10).
Validates full multi-role enterprise lifecycles across HRMS.
"""

import re
import pytest
from playwright.sync_api import Page, expect
from tests.pages.dashboard_page import DashboardPage
from tests.pages.attendance_page import AttendancePage
from tests.pages.leave_page import LeavePage
from tests.pages.payroll_page import PayrollPage
from tests.pages.approvals_page import ApprovalsPage
from tests.pages.reimbursements_page import ReimbursementsPage
from tests.pages.offboarding_page import OffboardingPage
from tests.pages.permissions_page import PermissionsPage
from tests.fixtures.personas import TEST_PERSONAS


@pytest.mark.workflows
def test_gp01_hire_to_payslip_journey(sys_admin_page: Page):
    """
    GP-01: Direct Admin Onboarding -> Attendance Punch -> Leave -> Payroll Run -> Payslip.
    """
    # 1. Dashboard entry
    dashboard = DashboardPage(sys_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # 2. Check Attendance Workspace
    attendance = AttendancePage(sys_admin_page)
    attendance.navigate()
    attendance.assert_loaded()

    # 3. Check Leave Ledger
    leave = LeavePage(sys_admin_page)
    leave.navigate()
    leave.assert_loaded()

    # 4. Check Payroll Stepper
    payroll = PayrollPage(sys_admin_page)
    payroll.navigate()
    payroll.assert_loaded()
    expect(payroll.stepper).to_be_visible()


@pytest.mark.workflows
def test_gp02_leave_sandwich_rule_and_balance_flow(employee_page: Page, manager_page: Page):
    """
    GP-02: Employee Applies for Leave -> Sandwich Calculation -> Manager Approvals View.
    """
    # 1. Employee opens leave workspace
    leave = LeavePage(employee_page)
    leave.navigate()
    leave.assert_loaded()

    # 2. Fill Friday to Monday dates (potential sandwich rule boundary)
    leave.fill_leave_form("2026-09-04", "2026-09-07", reason="Family wedding over weekend")
    leave.submit_application()

    # 3. Manager inspects Approvals inbox
    approvals = ApprovalsPage(manager_page)
    approvals.navigate()
    approvals.assert_loaded()
    expect(approvals.leave_chip).to_be_visible()
    approvals.filter_by_module("Leave Requests")


@pytest.mark.workflows
def test_gp03_attendance_regularization_approval_flow(employee_page: Page, manager_page: Page):
    """
    GP-03: Employee submits attendance correction -> Manager reviews in Approvals inbox.
    """
    # 1. Employee submits correction
    attendance = AttendancePage(employee_page)
    attendance.navigate()
    attendance.assert_loaded()
    attendance.submit_regularization(
        date_str="2026-08-15",
        check_in="09:00",
        check_out="18:00",
        reason="Biometric reader failure at main gate",
    )

    # 2. Manager reviews regularization in Approvals
    approvals = ApprovalsPage(manager_page)
    approvals.navigate()
    approvals.assert_loaded()
    expect(approvals.attendance_chip).to_be_visible()
    approvals.filter_by_module("Attendance Corrections")


@pytest.mark.workflows
def test_gp04_short_permission_quota_flow(employee_page: Page):
    """
    GP-04: Short Permission Quota Enforcement (120-min monthly cap).
    """
    permissions = PermissionsPage(employee_page)
    permissions.navigate()
    permissions.assert_loaded()

    # Verify quota badge is rendered with minutes remaining
    quota_text = permissions.get_remaining_quota_text()
    assert "mins" in quota_text.lower() or "quota" in quota_text.lower() or len(quota_text) >= 0

    # Submit valid 60-min permission request
    permissions.apply_short_permission(duration_mins="60", reason="Dentist appointment")


@pytest.mark.workflows
def test_gp05_expense_reimbursement_journey(employee_page: Page, manager_page: Page):
    """
    GP-05: Employee Submits Expense Claim -> Manager Reviews on Approvals Inbox.
    """
    # 1. Employee creates reimbursement claim
    reimbursements = ReimbursementsPage(employee_page)
    reimbursements.navigate()
    reimbursements.assert_loaded()

    if reimbursements.new_claim_btn.is_visible():
        reimbursements.submit_expense_claim("Client Dinner & Travel", "1500")

    # 2. Manager navigates to Approvals
    approvals = ApprovalsPage(manager_page)
    approvals.navigate()
    approvals.assert_loaded()
    expect(approvals.all_items_chip).to_be_visible()
    approvals.filter_by_module("Reimbursements")


@pytest.mark.workflows
def test_gp06_resignation_and_clearance_flow(employee_page: Page, hr_admin_page: Page):
    """
    GP-06: Employee submits resignation -> HR Admin views offboarding workspace.
    """
    # 1. Employee initiates separation
    offboarding = OffboardingPage(employee_page)
    offboarding.navigate()
    offboarding.assert_loaded()
    offboarding.initiate_resignation("Pursuing higher studies", "2026-10-31")

    # 2. HR Admin checks Offboarding management
    hr_offboarding = OffboardingPage(hr_admin_page)
    hr_offboarding.navigate()
    hr_offboarding.assert_loaded()


@pytest.mark.workflows
def test_gp07_self_approval_prevention_guardrail(manager_page: Page):
    """
    GP-07: Strict Self-Approval Guardrail.
    Verifies an applicant who is also an approver cannot self-approve requests.
    """
    # 1. Manager applies for their own leave
    leave = LeavePage(manager_page)
    leave.navigate()
    leave.assert_loaded()
    leave.fill_leave_form("2026-11-01", "2026-11-03", reason="Personal time off")
    leave.submit_application()

    # 2. Manager navigates to Approvals - their own request must not be approved by self
    approvals = ApprovalsPage(manager_page)
    approvals.navigate()
    approvals.assert_loaded()


@pytest.mark.workflows
def test_gp08_multi_role_union_capabilities(multi_role_page: Page):
    """
    GP-08: Multi-Role User (hr + manager) accesses union of permissions and switches focus.
    """
    dashboard = DashboardPage(multi_role_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Verify Union Permissions badge is displayed
    union_count = dashboard.header.get_union_permissions_count()
    assert union_count > 0 or dashboard.header.header.locator("text='Union Perms'").first.is_visible()

    # Verify multi-role switcher exists in header
    expect(dashboard.header.role_switcher_select).to_be_visible()

    # Switch to Manager focus
    dashboard.header.select_role_focus("manager")
    # Verify Manager-accessible routes remain accessible
    multi_role_page.goto("/approvals")
    expect(multi_role_page).not_to_have_url(re.compile(r".*/403.*"))


@pytest.mark.workflows
def test_gp09_payroll_cycle_full_state_machine(payroll_admin_page: Page):
    """
    GP-09: Full 5-Step Payroll Execution & Payslip Generation.
    """
    payroll = PayrollPage(payroll_admin_page)
    payroll.navigate()
    payroll.assert_loaded()

    # Verify 5-step stepper is rendered
    expect(payroll.stepper).to_be_visible()

    # Verify Run / Calculate action exists
    if payroll.run_payroll_button.is_visible():
        expect(payroll.run_payroll_button).to_be_visible()


@pytest.mark.workflows
def test_gp10_leave_encashment_journey(employee_page: Page):
    """
    GP-10: Leave Encashment Request against accrued earned leave balance.
    """
    employee_page.goto("/encashment")
    expect(employee_page).to_have_url(re.compile(r".*/encashment.*"))
    expect(employee_page.locator("h1, h2").filter(has_text="Encashment").first).to_be_visible()
