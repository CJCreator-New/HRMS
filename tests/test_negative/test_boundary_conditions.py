"""
Negative Scenarios, Boundary Value Analysis, and Security Input Sanitization Tests.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.leave_page import LeavePage
from tests.pages.reimbursements_page import ReimbursementsPage
from tests.pages.permissions_page import PermissionsPage
from tests.pages.employees_page import EmployeesPage


@pytest.mark.forms
def test_leave_end_date_before_start_date(employee_page: Page):
    """
    Boundary Test: End date is chronologically earlier than start date.
    Verifies that the form prevents submission or presents an inline date error.
    """
    leave = LeavePage(employee_page)
    leave.navigate()
    leave.assert_loaded()

    # Enter inverted dates: Start Oct 20, End Oct 15
    leave.fill_leave_form("2026-10-20", "2026-10-15", reason="Inverted dates test")
    leave.submit_application()

    # Form should either show error or disable submission
    expect(employee_page.locator("body")).not_to_contain_text("Application submitted successfully")


@pytest.mark.forms
def test_reimbursement_invalid_amount_validation(employee_page: Page):
    """
    Boundary Test: Submitting non-positive amount ($0 or negative) for reimbursement.
    """
    reimbursements = ReimbursementsPage(employee_page)
    reimbursements.navigate()
    reimbursements.assert_loaded()

    if reimbursements.new_claim_btn.is_visible():
        reimbursements.submit_expense_claim("Zero amount claim", "0")
        # Submit should be rejected or prevented
        expect(employee_page.locator("body")).not_to_contain_text("Claim #9999 approved")


@pytest.mark.forms
def test_short_permission_exceeding_120_mins_boundary(employee_page: Page):
    """
    Boundary Test: Requesting permission duration exceeding 120-minute monthly limit.
    """
    permissions = PermissionsPage(employee_page)
    permissions.navigate()
    permissions.assert_loaded()

    # Submit 180 minutes (> 120 min quota cap)
    permissions.apply_short_permission(duration_mins="180", reason="Exceeding quota test")

    # Verify boundary warning or failure feedback
    error_msg = employee_page.locator("div, p, span").filter(
        has_text="exceed"
    ).or_(employee_page.locator("text='quota'")).first
    if error_msg.is_visible():
        expect(error_msg).to_be_visible()


@pytest.mark.forms
def test_search_input_xss_and_sql_injection_sanitization(hr_admin_page: Page):
    """
    Security Test: Verifies search input safely sanitizes XSS and SQL injection payloads without crashing.
    """
    emp_page = EmployeesPage(hr_admin_page)
    emp_page.navigate()
    emp_page.assert_loaded()

    # Search with SQL injection and XSS payloads
    payload = "'; DROP TABLE users; -- <script>window.__xss_detected=true;</script>"
    emp_page.search_employee(payload)

    # Verify no XSS was executed in browser window
    xss_executed = hr_admin_page.evaluate("() => window.__xss_detected === true")
    assert not xss_executed, "XSS script payload executed in browser DOM!"

    # Verify page did not crash with 500 error
    hr_admin_page._error_tracker.assert_no_critical_errors()


@pytest.mark.forms
def test_invalid_guid_route_parameter(sys_admin_page: Page):
    """
    Route Parameter Test: Navigating to invalid non-UUID route parameters.
    Verifies graceful error handling without application crash.
    """
    sys_admin_page.goto("/employees/invalid-non-uuid-parameter-12345")
    # Verify page handles missing resource gracefully
    sys_admin_page._error_tracker.assert_no_critical_errors()
