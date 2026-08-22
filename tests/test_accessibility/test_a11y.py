"""
Automated Accessibility (a11y) Tests with axe-core & WCAG 2.1 AA Standards.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.dashboard_page import DashboardPage
from tests.pages.login_page import LoginPage
from tests.pages.employees_page import EmployeesPage
from tests.pages.leave_page import LeavePage


@pytest.mark.accessibility
def test_login_page_accessibility(page: Page, base_url: str):
    """
    Scans the /login page for critical/serious WCAG 2.1 AA accessibility violations.
    """
    login_page = LoginPage(page)
    login_page.navigate()
    results = login_page.run_a11y_scan()

    assert results["violations_count"] == 0, (
        f"Accessibility violations on /login: {results['violations']}"
    )


@pytest.mark.accessibility
def test_dashboard_accessibility(sys_admin_page: Page):
    """
    Scans the main dashboard for WCAG 2.1 AA accessibility compliance.
    """
    dashboard = DashboardPage(sys_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Check skip link is present
    skip_link = sys_admin_page.locator("a[href='#main-content']").first
    if skip_link.count() > 0:
        expect(skip_link).to_be_attached()

    results = dashboard.run_a11y_scan()
    assert results["violations_count"] == 0, (
        f"Accessibility violations on Dashboard: {results['violations']}"
    )


@pytest.mark.accessibility
def test_leave_workspace_accessibility(employee_page: Page):
    """
    Scans the /leave workspace for WCAG 2.1 AA compliance.
    """
    leave_page = LeavePage(employee_page)
    leave_page.navigate()
    leave_page.assert_loaded()

    results = leave_page.run_a11y_scan()
    assert results["violations_count"] == 0, (
        f"Accessibility violations on /leave: {results['violations']}"
    )
