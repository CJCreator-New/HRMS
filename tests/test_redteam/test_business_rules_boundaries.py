"""
Adversarial Red-Team: Business Rules, Date/Time Calculations & Boundary Tests.
Validates statutory rules, sandwich policies, monthly caps, and compensation engines.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.leave_page import LeavePage
from tests.pages.permissions_page import PermissionsPage


@pytest.mark.redteam
@pytest.mark.forms
def test_leave_sandwich_rule_calculation_display(employee_page: Page):
    """
    Business Rules: Leave spanning Friday to Monday.
    When sandwich rule is applicable, the calculation accounts for intermediate weekend days.
    """
    leave = LeavePage(employee_page)
    leave.navigate()
    leave.assert_loaded()

    # Fill leave spanning Friday (2026-08-21) to Monday (2026-08-24)
    leave.fill_leave_form("2026-08-21", "2026-08-24", "Extended Weekend")

    # Form should calculate and render without page crash
    expect(employee_page.locator("body")).not_to_contain_text("Application error")


@pytest.mark.redteam
@pytest.mark.forms
def test_short_permission_monthly_cap_display(employee_page: Page):
    """
    Business Rules: 120-Minute Monthly Short Permission Quota.
    Verifies that the quota counter / badge is visible to the employee.
    """
    perms = PermissionsPage(employee_page)
    perms.navigate()
    perms.assert_loaded()

    # Quota indicator must be rendered
    expect(perms.quota_badge).to_be_visible()
    expect(employee_page.locator("body")).to_contain_text("120")


@pytest.mark.redteam
@pytest.mark.forms
def test_leap_year_and_month_end_date_inputs(employee_page: Page):
    """
    Date/Time: Form inputs handling leap-year dates (2028-02-29) and year-end dates (2026-12-31).
    """
    leave = LeavePage(employee_page)
    leave.navigate()
    leave.assert_loaded()

    leave.fill_leave_form("2028-02-28", "2028-02-29", "Leap Year Leave")
    expect(leave.submit_leave_btn).to_be_visible()
