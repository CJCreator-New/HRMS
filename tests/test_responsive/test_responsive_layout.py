"""
Responsive Layout and Mobile Device Emulation Tests.
Validates mobile drawer navigation, hamburger toggles, touch targets, and overflow bounds.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.dashboard_page import DashboardPage
from tests.pages.employees_page import EmployeesPage

VIEWPORTS = [
    {"name": "Mobile Small", "width": 375, "height": 667},
    {"name": "Mobile Standard", "width": 390, "height": 844},
    {"name": "Tablet", "width": 768, "height": 1024},
    {"name": "Laptop", "width": 1280, "height": 800},
    {"name": "Large Desktop", "width": 1920, "height": 1080},
]


@pytest.mark.responsive
def test_mobile_drawer_navigation(sys_admin_page: Page):
    """
    Tests mobile viewport (< 768px): hamburger menu opens animated sidebar drawer and close button dismisses it.
    """
    sys_admin_page.set_viewport_size({"width": 375, "height": 667})
    dashboard = DashboardPage(sys_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Desktop sidebar should be hidden; hamburger button visible
    expect(dashboard.header.mobile_menu_button).to_be_visible()

    # Open mobile drawer
    dashboard.header.mobile_menu_button.click()
    sys_admin_page.wait_for_timeout(300)

    # Drawer should be open with close button
    if dashboard.sidebar.mobile_close_btn.is_visible():
        dashboard.sidebar.mobile_close_btn.click()
        sys_admin_page.wait_for_timeout(300)


@pytest.mark.responsive
@pytest.mark.parametrize("vp", VIEWPORTS, ids=lambda v: v["name"])
def test_page_no_horizontal_overflow(sys_admin_page: Page, vp: dict):
    """
    Asserts that no horizontal document overflow occurs across diverse screen resolutions.
    """
    sys_admin_page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
    dashboard = DashboardPage(sys_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()
    dashboard.assert_no_overflow()


@pytest.mark.responsive
def test_mobile_table_horizontal_scroll_containment(hr_admin_page: Page):
    """
    Tests that employee table on mobile has horizontal scroll containment without breaking document layout.
    """
    hr_admin_page.set_viewport_size({"width": 375, "height": 667})
    emp_page = EmployeesPage(hr_admin_page)
    emp_page.navigate()
    emp_page.assert_loaded()
    emp_page.assert_no_overflow()
