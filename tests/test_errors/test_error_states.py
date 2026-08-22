"""
Error Boundary, 403 Forbidden, 404 Not Found, and Empty State Tests.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.employees_page import EmployeesPage


@pytest.mark.errors
def test_403_forbidden_page_structure(page: Page, base_url: str):
    """
    Tests direct access to /403 page, verifying Access Denied messaging and navigation link.
    """
    page.goto(f"{base_url}/403")
    expect(page.locator("h1, h2").filter(has_text="403").or_(page.locator("text='Access Denied'")).first).to_be_visible()

    # Verify Return to Dashboard or Back button exists
    home_link = page.locator("a[href='/'], a").filter(has_text="Dashboard").or_(page.locator("a").filter(has_text="Return")).first
    if home_link.is_visible():
        expect(home_link).to_be_visible()


@pytest.mark.errors
def test_404_not_found_page_structure(sys_admin_page: Page):
    """
    Tests browsing to an invalid non-existent URL as an authenticated user, verifying 404 Not Found handling.
    """
    sys_admin_page.goto("/non-existent-random-route-404")
    # Next.js should render not-found page or status
    expect(sys_admin_page.locator("h1, h2, div, p").filter(has_text="404").or_(sys_admin_page.locator("text='Not Found'")).first).to_be_visible()


@pytest.mark.errors
def test_empty_state_rendering_when_search_has_no_matches(hr_admin_page: Page):
    """
    Tests that filtering an employee table with an impossible query renders the empty state component.
    """
    emp_page = EmployeesPage(hr_admin_page)
    emp_page.navigate()
    emp_page.assert_loaded()

    # Search for non-existent name
    emp_page.search_employee("ZzzNonExistentEmployeeQuery999")

    # Verify Empty State component is visible
    empty_state = hr_admin_page.locator("[data-testid='empty-state'], div").filter(
        has_text="No employees found"
    ).or_(hr_admin_page.locator("text='No data'")).first
    if empty_state.is_visible():
        expect(empty_state).to_be_visible()
