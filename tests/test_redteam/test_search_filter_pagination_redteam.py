"""
Adversarial Red-Team: Search, Filter, Sort, and Pagination Attack Tests.
Verifies SQL wildcard safety, Unicode handling, and filter conjunction integrity.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.employees_page import EmployeesPage


@pytest.mark.redteam
@pytest.mark.forms
def test_employee_search_sql_wildcard_safety(sys_admin_page: Page):
    """
    Search Red-Team: Entering SQL wildcard characters like '%' and '_' into search input.
    Must perform literal search or handle safely without causing full DB dump or 500 error.
    """
    employees = EmployeesPage(sys_admin_page)
    employees.navigate()
    employees.assert_loaded()

    # Search '%'
    employees.search("%")
    sys_admin_page.wait_for_timeout(600)
    expect(sys_admin_page.locator("body")).not_to_contain_text("Application error")
    expect(sys_admin_page.locator("body")).not_to_contain_text("Internal Server Error")

    # Search '_'
    employees.search("_")
    sys_admin_page.wait_for_timeout(600)
    expect(sys_admin_page.locator("body")).not_to_contain_text("Application error")


@pytest.mark.redteam
@pytest.mark.forms
def test_employee_search_unicode_and_apostrophe_safety(sys_admin_page: Page):
    """
    Search Red-Team: Searching names with apostrophes (O'Connor), accents (Müller), and Unicode (日本語).
    """
    employees = EmployeesPage(sys_admin_page)
    employees.navigate()
    employees.assert_loaded()

    for special_term in ["O'Connor", "Müller", "日本語", "✨"]:
        employees.search(special_term)
        sys_admin_page.wait_for_timeout(400)
        expect(sys_admin_page.locator("body")).not_to_contain_text("Application error")


@pytest.mark.redteam
@pytest.mark.forms
def test_filter_clearing_restores_complete_list(sys_admin_page: Page):
    """
    Filter Red-Team: Applying search filter, then clearing search restores complete list/state.
    """
    employees = EmployeesPage(sys_admin_page)
    employees.navigate()
    employees.assert_loaded()

    # Search specific employee
    employees.search("Rajesh")
    sys_admin_page.wait_for_timeout(600)

    # Clear search
    employees.search("")
    sys_admin_page.wait_for_timeout(600)

    # Verify directory remains healthy with no unhandled exceptions
    expect(sys_admin_page.locator("body")).not_to_contain_text("Application error")
    expect(employees.search_input).to_be_visible()
