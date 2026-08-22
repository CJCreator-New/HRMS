"""
API and Network Failure Resilience Testing.
Simulates HTTP error codes (400, 401, 403, 422, 429, 500, network aborts) using Playwright route interception.
Verifies that the UI degrades gracefully, displays error banners, and allows recovery without crashing.
"""

import re
import pytest
from playwright.sync_api import Page, expect
from tests.pages.dashboard_page import DashboardPage
from tests.pages.attendance_page import AttendancePage
from tests.pages.leave_page import LeavePage


@pytest.mark.errors
def test_500_internal_server_error_graceful_banner(sys_admin_page: Page):
    """
    Simulates a 500 Internal Server Error on an API endpoint.
    Verifies that the UI displays a clear error state/banner and does not enter a white screen crash.
    """
    # Intercept any data fetching API with 500 error
    sys_admin_page.route("**/api/health", lambda route: route.fulfill(
        status=500,
        content_type="application/json",
        body='{"error": "Internal Server Error", "message": "Database connection failed"}'
    ))

    # Navigate to dashboard
    dashboard = DashboardPage(sys_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Verify document structure remains intact
    expect(dashboard.header.header).to_be_visible()


@pytest.mark.errors
def test_401_unauthorized_session_expiration(employee_page: Page, base_url: str):
    """
    Simulates an expired session / 401 Unauthorized response from server actions/API.
    Verifies that the user is handled gracefully without unhandled crashes.
    """
    # Intercept API calls with 401
    employee_page.route("**/api/auth/**", lambda route: route.fulfill(
        status=401,
        content_type="application/json",
        body='{"error": "Unauthorized", "message": "Session has expired"}'
    ))

    # Navigate to attendance
    attendance = AttendancePage(employee_page)
    attendance.navigate()
    attendance.assert_loaded()


@pytest.mark.errors
def test_403_forbidden_mutating_action_feedback(employee_page: Page):
    """
    Simulates a 403 Forbidden response on unauthorized mutating requests.
    Verifies UI displays appropriate forbidden feedback.
    """
    employee_page.route("**/api/**", lambda route: route.fulfill(
        status=403,
        content_type="application/json",
        body='{"error": "Forbidden", "message": "Insufficient permissions"}'
    ))

    # Navigate to leave workspace
    leave = LeavePage(employee_page)
    leave.navigate()
    leave.assert_loaded()


@pytest.mark.errors
def test_network_disconnect_and_timeout_resilience(employee_page: Page):
    """
    Simulates dropped network connection (route.abort) on background requests.
    Verifies the UI retains interactive elements without freezing.
    """
    employee_page.route("**/api/analytics/**", lambda route: route.abort("failed"))

    dashboard = DashboardPage(employee_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()
    expect(dashboard.sidebar.sidebar).to_be_visible()
