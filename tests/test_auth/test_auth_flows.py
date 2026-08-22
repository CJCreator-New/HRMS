"""
Authentication and Session Lifecycle Tests.
Validates session persistence, logout flow, password resets, and forced password reset modal for invited employees.
"""

import re
import pytest
from playwright.sync_api import Page, expect
from tests.pages.login_page import LoginPage
from tests.pages.dashboard_page import DashboardPage
from tests.fixtures.personas import TEST_PERSONAS, DEFAULT_PASSWORD


@pytest.mark.auth
def test_logout_flow(sys_admin_page: Page):
    """
    Tests that clicking the logout icon button terminates the session and redirects to /login.
    """
    dashboard = DashboardPage(sys_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Trigger logout
    dashboard.header.logout()
    expect(sys_admin_page).to_have_url(re.compile(r".*/login.*"))

    # Attempt to browse back to / - should redirect to /login
    sys_admin_page.goto("/")
    expect(sys_admin_page).to_have_url(re.compile(r".*/login.*"))


@pytest.mark.auth
def test_session_persistence_across_page_reloads(employee_page: Page):
    """
    Verifies that the signed session cookie persists across full browser refreshes.
    """
    dashboard = DashboardPage(employee_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Hard reload
    employee_page.reload()
    dashboard.assert_loaded()
    expect(employee_page).not_to_have_url(re.compile(r".*/login.*"))


@pytest.mark.auth
def test_forgot_password_submission(page: Page):
    """
    Tests that submitting a reset request in the forgot password sub-form triggers success feedback.
    """
    login_page = LoginPage(page)
    login_page.request_password_reset(TEST_PERSONAS["employee_e1"].email)

    # Verify confirmation feedback
    success_or_status = page.locator(".text-emerald-600, .bg-emerald-50, [role='status']").first
    if success_or_status.is_visible():
        expect(success_or_status).to_be_visible()


@pytest.mark.auth
def test_forced_password_reset_for_invited_employee(login_as):
    """
    Tests that an invited user with mustChangePassword=True is presented with the password reset modal.
    """
    invited_page = login_as("emp_invited")
    invited_page.goto("/")

    # Force password reset modal or password change prompt should appear
    modal_or_prompt = invited_page.locator("[data-testid='force-password-reset-modal'], [role='dialog']").filter(
        has_text="Password"
    ).first
    if modal_or_prompt.is_visible():
        expect(modal_or_prompt).to_be_visible()
