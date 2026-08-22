"""
RBAC Route Authorization Matrix Tests.
Validates permission boundaries, manager salary isolation, employee restricted access, and system admin global bypass.
"""

import re
import pytest
from playwright.sync_api import Page, expect

EMPLOYEE_ALLOWED_ROUTES = [
    "/",
    "/attendance",
    "/leave",
    "/reimbursements",
    "/documents",
    "/encashment",
]

EMPLOYEE_FORBIDDEN_ROUTES = [
    "/payroll",
    "/settings",
    "/audit",
    "/jobs",
    "/statutory",
    "/onboarding",
]

SYSADMIN_ROUTES = [
    "/",
    "/employees",
    "/onboarding",
    "/departments",
    "/payroll",
    "/salary",
    "/statutory",
    "/settings",
    "/audit",
    "/jobs",
    "/reports",
]


@pytest.mark.rbac
@pytest.mark.parametrize("route", EMPLOYEE_ALLOWED_ROUTES)
def test_employee_allowed_routes(employee_page: Page, route: str):
    """
    Validates that a standard employee has access to self-service routes.
    """
    employee_page.goto(route)
    employee_page.wait_for_load_state("domcontentloaded")
    # Must not be redirected to 403 or login
    expect(employee_page).not_to_have_url(re.compile(r".*(/403|/login).*"))
    expect(employee_page.locator("main, #main-content").first).to_be_visible()


@pytest.mark.rbac
@pytest.mark.parametrize("route", EMPLOYEE_FORBIDDEN_ROUTES)
def test_employee_forbidden_routes(employee_page: Page, route: str):
    """
    Validates that a standard employee is denied access (403 Forbidden or redirected) to administrative routes.
    """
    employee_page.goto(route)
    employee_page.wait_for_load_state("domcontentloaded")

    # Should either be on /403, /login, or display Access Denied banner
    is_403 = "/403" in employee_page.url
    is_login = "/login" in employee_page.url
    has_denied_text = employee_page.locator("h1, h2, div, p").filter(
        has_text="Access Denied"
    ).or_(employee_page.locator("h1, h2, div, p").filter(has_text="403")).first.is_visible()

    assert is_403 or is_login or has_denied_text, f"Employee was unexpectedly allowed access to {route}"


@pytest.mark.rbac
def test_manager_salary_isolation(manager_page: Page):
    """
    Critical Security Test: Verifies that Managers cannot access /salary (salary structures / CTCs).
    """
    manager_page.goto("/salary")
    manager_page.wait_for_load_state("domcontentloaded")

    is_403 = "/403" in manager_page.url
    has_forbidden = manager_page.locator("text='Access Denied'").or_(manager_page.locator("text='403'")).first.is_visible()
    assert is_403 or has_forbidden, "Manager was unexpectedly granted access to /salary"


@pytest.mark.rbac
@pytest.mark.parametrize("route", SYSADMIN_ROUTES)
def test_system_admin_unconditional_access(sys_admin_page: Page, route: str):
    """
    Validates that System Admin has bypass access across all application modules.
    """
    sys_admin_page.goto(route)
    sys_admin_page.wait_for_load_state("domcontentloaded")
    expect(sys_admin_page).not_to_have_url(re.compile(r".*(/403|/login).*"))
    expect(sys_admin_page.locator("main, #main-content").first).to_be_visible()


@pytest.mark.rbac
def test_suspended_employee_denied_access(login_as):
    """
    Validates that a suspended employee (emp_suspended) has access revoked across protected routes.
    """
    suspended_page = login_as("emp_suspended")
    suspended_page.goto("/")
    suspended_page.wait_for_load_state("domcontentloaded")

    is_denied = "/403" in suspended_page.url or "/login" in suspended_page.url or \
                suspended_page.locator("text='Access Denied'").first.is_visible() or \
                suspended_page.locator("text='Suspended'").first.is_visible()
    assert is_denied, "Suspended employee was unexpectedly permitted to access dashboard"
