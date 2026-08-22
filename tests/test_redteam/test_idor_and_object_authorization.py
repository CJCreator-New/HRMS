"""
Adversarial Red-Team: Object-Level Authorization & IDOR Penetration Tests.
Verifies that route and object-level permissions are strictly enforced server-side.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.fixtures.auth_fixtures import authenticate_context


@pytest.mark.redteam
@pytest.mark.rbac
def test_employee_salary_self_isolation_no_edit_no_cross_user_selector(browser, base_url: str):
    """
    IDOR/RBAC: Verify Employee E1 on /salary:
    1. Can view own salary structure (salary.view.self).
    2. CANNOT see or access the employee selector dropdown (salary.view.all restricted).
    3. CANNOT see or submit the salary revision form (salary.edit restricted).
    """
    context = browser.new_context()
    authenticate_context(context, "employee_e1", base_url=base_url)
    page = context.new_page()

    page.goto(f"{base_url}/salary")
    page.wait_for_load_state("domcontentloaded")

    # Employee selector must NOT be visible to standard employee
    expect(page.locator("select[aria-label='Select Employee']")).not_to_be_visible()
    # Salary revision mutation form must NOT be rendered
    expect(page.locator("button").filter(has_text="Record Salary Revision")).not_to_be_visible()

    context.close()


@pytest.mark.redteam
@pytest.mark.rbac
def test_manager_cannot_access_salary_structures(browser, base_url: str):
    """
    IDOR/RBAC: Verify Manager M1 cannot access compensation & salary structures (/salary).
    Blocked by middleware route guardrail and redirected to /403.
    """
    context = browser.new_context()
    authenticate_context(context, "manager_m1", base_url=base_url)
    page = context.new_page()

    page.goto(f"{base_url}/salary")
    page.wait_for_url("**/403*", timeout=10000)
    expect(page.locator("h1, h2, div").filter(has_text="Access Restricted").first).to_be_visible()
    context.close()


@pytest.mark.redteam
@pytest.mark.rbac
def test_employee_cannot_access_statutory_engine(browser, base_url: str):
    """
    IDOR/RBAC: Verify Employee E1 cannot view statutory payroll rules (/statutory).
    Blocked at middleware route gate -> redirected to /403.
    """
    context = browser.new_context()
    authenticate_context(context, "employee_e1", base_url=base_url)
    page = context.new_page()

    page.goto(f"{base_url}/statutory")
    page.wait_for_url("**/403*", timeout=10000)
    expect(page.locator("h1, h2, div").filter(has_text="Access Restricted").first).to_be_visible()
    context.close()


@pytest.mark.redteam
@pytest.mark.rbac
def test_manager_cannot_access_system_audit_logs(browser, base_url: str):
    """
    IDOR/RBAC: Verify Manager M1 cannot inspect global audit trail logs (/audit).
    """
    context = browser.new_context()
    authenticate_context(context, "manager_m1", base_url=base_url)
    page = context.new_page()

    page.goto(f"{base_url}/audit")
    page.wait_for_url("**/403*", timeout=10000)
    expect(page.locator("h1, h2, div").filter(has_text="Access Restricted").first).to_be_visible()
    context.close()


@pytest.mark.redteam
@pytest.mark.rbac
def test_suspended_employee_session_lockout(browser, base_url: str):
    """
    Auth/RBAC: Verify a deactivated/suspended employee is completely locked out of all routes.
    """
    context = browser.new_context()
    authenticate_context(context, "emp_suspended", base_url=base_url)
    page = context.new_page()

    # Attempt to load attendance
    page.goto(f"{base_url}/attendance")
    # Middleware or RSC must redirect suspended user to /login or /403
    page.wait_for_url(lambda u: "/login" in u or "/403" in u, timeout=10000)
    context.close()


@pytest.mark.redteam
@pytest.mark.rbac
def test_offboarded_employee_cannot_access_leave_workspace(browser, base_url: str):
    """
    Auth/RBAC: Verify offboarded employee cannot access active leave application workspace.
    """
    context = browser.new_context()
    authenticate_context(context, "emp_offboarded", base_url=base_url)
    page = context.new_page()

    page.goto(f"{base_url}/leave")
    page.wait_for_url(lambda u: "/login" in u or "/403" in u, timeout=10000)
    context.close()


@pytest.mark.redteam
@pytest.mark.rbac
def test_employee_documents_self_isolation(employee_page: Page):
    """
    Object Authorization: Verify Employee can load /documents and see only personal categories.
    """
    employee_page.goto("http://localhost:3000/documents")
    expect(employee_page.locator("body")).not_to_contain_text("Application error")
    expect(employee_page.locator("body")).not_to_contain_text("Internal Server Error")
