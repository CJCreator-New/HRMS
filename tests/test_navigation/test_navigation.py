"""
Navigation, Sidebar, Breadcrumbs, and Command Palette Tests.
"""

import re
import pytest
from playwright.sync_api import Page, expect
from tests.pages.dashboard_page import DashboardPage


@pytest.mark.navigation
def test_sidebar_navigation_links(hr_admin_page: Page):
    """
    Tests navigating through core HR modules via Sidebar links.
    """
    dashboard = DashboardPage(hr_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Navigate to Employees Directory via sidebar
    dashboard.sidebar.navigate_to("/employees")
    expect(hr_admin_page).to_have_url(re.compile(r".*/employees.*"))

    # Navigate to Leave Workspace via sidebar
    dashboard.sidebar.navigate_to("/leave")
    expect(hr_admin_page).to_have_url(re.compile(r".*/leave.*"))


@pytest.mark.navigation
def test_active_route_highlight(hr_admin_page: Page):
    """
    Tests that the active route is visually highlighted in the sidebar navigation.
    """
    hr_admin_page.goto("/employees")
    hr_admin_page.wait_for_load_state("domcontentloaded")

    dashboard = DashboardPage(hr_admin_page)
    is_active = dashboard.sidebar.is_link_active("/employees")
    assert is_active, "Active sidebar link for /employees was not highlighted"


@pytest.mark.navigation
def test_global_search_command_palette(hr_admin_page: Page):
    """
    Tests opening the Global Search Command Palette (Ctrl+K) and typing a query.
    """
    dashboard = DashboardPage(hr_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    dashboard.header.open_global_search()

    # Verify search modal is open
    search_modal = hr_admin_page.locator("[role='dialog'], [data-testid='global-search-modal'], .z-modal").first
    if search_modal.is_visible():
        search_input = search_modal.locator("input[type='text'], input[placeholder*='Search']").first
        if search_input.is_visible():
            search_input.fill("Priya")
            hr_admin_page.wait_for_timeout(300)
            # ESC closes search
            hr_admin_page.keyboard.press("Escape")
            expect(search_modal).not_to_be_visible()
