"""
Base Page Object for all HRMS page classes.
"""

from typing import Dict, Any
from playwright.sync_api import Page, expect
from tests.components.sidebar import SidebarComponent
from tests.components.header import HeaderComponent
from tests.utils.axe_helper import scan_accessibility
from tests.utils.assertions import assert_toast_message, assert_no_horizontal_overflow


class BasePage:
    PATH = "/"

    def __init__(self, page: Page):
        self.page = page
        self.sidebar = SidebarComponent(page)
        self.header = HeaderComponent(page)

    def navigate(self, path: str = None):
        """Navigates to the page URL."""
        target = path or self.PATH
        self.page.goto(target)
        self.page.wait_for_load_state("domcontentloaded")
        return self

    def get_heading(self) -> str:
        """Returns the main heading text of the page."""
        h1 = self.page.locator("main h1, main h2, header h1").first
        return h1.inner_text().strip() if h1.is_visible() else ""

    def assert_loaded(self):
        """Asserts that the main content region is loaded."""
        main = self.page.locator("main, #main-content").first
        expect(main).to_be_visible(timeout=8000)

    def assert_toast(self, message: str, timeout: float = 6000):
        """Asserts that a toast notification is displayed."""
        assert_toast_message(self.page, message, timeout=timeout)

    def assert_no_overflow(self):
        """Verifies that no horizontal overflow exists."""
        assert_no_horizontal_overflow(self.page)

    def run_a11y_scan(self) -> Dict[str, Any]:
        """Runs an axe-core accessibility scan on the current page."""
        return scan_accessibility(self.page)
