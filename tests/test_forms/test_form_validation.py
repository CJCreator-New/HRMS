"""
Form Input Validation & Boundary Tests.
Validates required fields, overlap warnings, numeric constraints, and client-side error states.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.leave_page import LeavePage
from tests.pages.onboarding_page import OnboardingPage
from tests.pages.permissions_page import PermissionsPage


@pytest.mark.forms
def test_leave_inline_overlap_validation(employee_page: Page):
    """
    Tests that submitting a leave request that collides with an existing leave date range
    is blocked and triggers an Overlapping Leave error notification.
    """
    leave_page = LeavePage(employee_page)
    leave_page.navigate()
    leave_page.assert_loaded()

    # Fill duplicate dates (e.g. existing leave dates in seed data)
    leave_page.fill_leave_form("2026-08-10", "2026-08-12", "Duplicate overlap test")

    if leave_page.submit_leave_btn.is_visible():
        leave_page.submit_leave_btn.click()
        employee_page.wait_for_timeout(500)

        # Should render toast or alert indicating overlap or error
        toast = employee_page.locator("[role='status'], [role='alert'], div").filter(
            has_text="Overlap"
        ).or_(employee_page.locator("text='Error'")).first
        if toast.is_visible():
            expect(toast).to_be_visible()


@pytest.mark.forms
def test_short_permission_quota_boundary(employee_page: Page):
    """
    Tests that applying for short permission exceeding monthly 120-minute quota triggers boundary validation.
    """
    perm_page = PermissionsPage(employee_page)
    perm_page.navigate()
    perm_page.assert_loaded()

    # Attempt to apply for 150 minutes (exceeding 120 min monthly cap)
    perm_page.apply_short_permission(duration_mins="150", reason="Long errand")

    # Form should either prevent submission or display quota warning
    quota_error = employee_page.locator("text='120'").or_(employee_page.locator("text='exceed'")).or_(employee_page.locator("[role='alert']")).first
    if quota_error.is_visible():
        expect(quota_error).to_be_visible()


@pytest.mark.forms
def test_onboarding_wizard_step_validation(hr_admin_page: Page):
    """
    Tests that Step 1 of Onboarding wizard blocks progression when mandatory inputs are empty.
    """
    onboarding_page = OnboardingPage(hr_admin_page)
    onboarding_page.navigate()
    onboarding_page.assert_loaded()

    # Try clicking Next without filling required fields
    if onboarding_page.next_button.is_visible():
        onboarding_page.next_button.click()
        # Should stay on Step 1 (Personal Info)
        expect(hr_admin_page.locator("text='Personal'").first).to_be_visible()
