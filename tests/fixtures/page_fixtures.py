"""
Role-specific Page fixtures for HRMS Python Playwright tests.
"""

from typing import Callable
import pytest
from playwright.sync_api import Browser, BrowserContext, Page
from tests.fixtures.personas import TEST_PERSONAS
from tests.fixtures.auth_fixtures import authenticate_context
from tests.utils.error_tracker import ErrorTracker


@pytest.fixture
def login_as(context: BrowserContext, base_url: str) -> Callable[[str], Page]:
    """
    Factory fixture to create an authenticated Page for any persona key.
    """
    def _login(persona_key: str) -> Page:
        authenticate_context(context, persona_key, base_url=base_url)
        page = context.new_page()
        # Attach error tracking
        tracker = ErrorTracker(page)
        setattr(page, "_error_tracker", tracker)
        return page

    return _login


@pytest.fixture
def sys_admin_page(login_as) -> Page:
    """Authenticated page for System Admin (sysadmin@company.com)."""
    return login_as("sys_admin")


@pytest.fixture
def hr_admin_page(login_as) -> Page:
    """Authenticated page for HR Admin (hradmin@company.com)."""
    return login_as("hr_admin")


@pytest.fixture
def payroll_admin_page(login_as) -> Page:
    """Authenticated page for Payroll Admin (payroll@company.com)."""
    return login_as("payroll_admin")


@pytest.fixture
def manager_page(login_as) -> Page:
    """Authenticated page for Manager Rajesh Kumar (manager.m1@company.com)."""
    return login_as("manager_m1")


@pytest.fixture
def employee_page(login_as) -> Page:
    """Authenticated page for Employee Priya Sharma (employee.e1@company.com)."""
    return login_as("employee_e1")


@pytest.fixture
def multi_role_page(login_as) -> Page:
    """Authenticated page for Multi-role HR+Manager Sunita Verma (multi.hrmgr@company.com)."""
    return login_as("multi_hr_mgr")
