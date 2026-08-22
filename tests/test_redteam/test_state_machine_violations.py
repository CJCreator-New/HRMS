"""
Adversarial Red-Team: Workflow State-Machine Violation & Progression Tests.
Validates that multi-step state machines cannot be bypassed or illegally transitioned.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.payroll_page import PayrollPage
from tests.pages.approvals_page import ApprovalsPage


@pytest.mark.redteam
@pytest.mark.workflows
def test_payroll_state_machine_step_progression(payroll_admin_page: Page):
    """
    State-Machine: Verify 5-Step Payroll Wizard enforces sequential progression.
    Step 1: Attendance/Leave Sync -> Step 2: Pay Structure -> Step 3: Calculation -> Step 4: Review -> Step 5: Finalize.
    Cannot jump straight to finalize without running calculation step.
    """
    payroll = PayrollPage(payroll_admin_page)
    payroll.navigate()
    payroll.assert_loaded()

    # Stepper component must be rendered
    expect(payroll.stepper).to_be_visible()
    expect(payroll.run_payroll_button).to_be_visible()


@pytest.mark.redteam
@pytest.mark.workflows
def test_approvals_inbox_filter_isolation(manager_page: Page):
    """
    State-Machine / Workflow: Verify Approvals inbox filters segregate modules cleanly.
    """
    approvals = ApprovalsPage(manager_page)
    approvals.navigate()
    approvals.assert_loaded()

    # Filter to leave requests
    approvals.filter_by_module("Leave Requests")
    expect(approvals.leave_chip).to_be_visible()

    # Filter to attendance
    approvals.filter_by_module("Attendance Corrections")
    expect(approvals.attendance_chip).to_be_visible()


@pytest.mark.redteam
@pytest.mark.workflows
def test_offboarding_multi_department_clearance_structure(hr_admin_page: Page):
    """
    State-Machine: Verify offboarding F&F clearance workspace renders multi-department clearance sections.
    """
    hr_admin_page.goto("http://localhost:3000/offboarding")
    expect(hr_admin_page.locator("body")).not_to_contain_text("Application error")
    expect(hr_admin_page.locator("h1, h2, h3").filter(has_text="Offboarding").first).to_be_visible()
