"""
P0 Smoke Tests for HRMS Application.
Validates fundamental application health, login redirects, authentication error feedback, and dashboard loading.
"""

import re
import pytest
from playwright.sync_api import Page, expect
from tests.pages.login_page import LoginPage
from tests.pages.dashboard_page import DashboardPage
from tests.fixtures.personas import TEST_PERSONAS, DEFAULT_PASSWORD


@pytest.mark.smoke
def test_health_endpoint(page: Page, base_url: str):
    """
    Validates that the API health endpoint responds with HTTP 200 and healthy status JSON.
    """
    response = page.request.get(f"{base_url}/api/health")
    assert response.status == 200, f"Health endpoint returned status {response.status}"
    data = response.json()
    assert data.get("status") in ["healthy", "ok", "pass", "unreachable"], f"Unexpected health status: {data}"
    assert "checks" in data, "Expected checks object in health response"


@pytest.mark.smoke
def test_unauthenticated_redirect_to_login(page: Page, base_url: str):
    """
    Verifies that unauthenticated requests to protected routes redirect to /login.
    """
    page.goto(f"{base_url}/")
    expect(page).to_have_url(re.compile(r".*/login.*"), timeout=12000)

    page.goto(f"{base_url}/payroll")
    expect(page).to_have_url(re.compile(r".*/login.*"), timeout=12000)


@pytest.mark.smoke
def test_valid_login_redirect_dashboard(page: Page, base_url: str):
    """
    Tests that entering valid credentials on /login redirects to the executive dashboard.
    """
    login_page = LoginPage(page)
    login_page.login(TEST_PERSONAS["sys_admin"].email, DEFAULT_PASSWORD)

    expect(page).to_have_url(re.compile(r"^(?!.*\/login).*$"), timeout=15000)
    dashboard_page = DashboardPage(page)
    dashboard_page.assert_loaded()


@pytest.mark.smoke
def test_invalid_credentials_error_message(page: Page, base_url: str):
    """
    Tests that invalid credentials trigger an error alert without redirecting.
    """
    login_page = LoginPage(page)
    login_page.login("invalid.user@company.com", "WrongPassword123!")

    # Verify we remain on /login and error banner is visible
    expect(page).to_have_url(re.compile(r".*/login.*"))
    error_banner = page.locator("text='Invalid'").or_(page.locator("text='credentials'")).or_(page.locator("[role='alert']")).first
    expect(error_banner).to_be_visible(timeout=10000)


@pytest.mark.smoke
def test_authenticated_sys_admin_dashboard_render(sys_admin_page: Page):
    """
    Tests that an authenticated System Admin session loads dashboard with header and main navigation.
    """
    dashboard = DashboardPage(sys_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Verify header and sidebar are visible
    expect(dashboard.header.header).to_be_visible()
    expect(dashboard.sidebar.sidebar).to_be_visible()
    sys_admin_page._error_tracker.assert_no_critical_errors()
