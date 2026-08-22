"""
Header Navigation Component Object.
Manages breadcrumbs, page heading, global search trigger, role switcher, and logout.
"""

import re
from playwright.sync_api import Page, Locator, expect


class HeaderComponent:
    def __init__(self, page: Page):
        self.page = page
        self.header = page.locator("header").first
        self.mobile_menu_button = page.get_by_role("button", name="Open navigation menu")
        self.search_button = page.locator("button").filter(has_text="Search").or_(page.locator("button[aria-label*='Search']")).first
        self.role_switcher_select = page.locator("[data-testid='role-switcher-select']")
        self.notifications_button = page.locator("button[aria-label*='Notification']").first
        self.logout_button = page.get_by_role("button", name="Sign out of system")

    def get_title(self) -> str:
        """Returns the active page title in the header."""
        return self.header.locator("h1").first.inner_text().strip()

    def get_union_permissions_count(self) -> int:
        """Returns the number of union permissions shown in the emerald badge."""
        badge = self.header.locator("span").filter(has_text="Union Perms").first
        if badge.is_visible():
            text = badge.inner_text()
            digits = "".join(c for c in text if c.isdigit())
            return int(digits) if digits else 0
        return 0

    def select_role_focus(self, role_code: str):
        """Switches the active role view for a multi-role persona."""
        expect(self.role_switcher_select).to_be_visible()
        self.role_switcher_select.select_option(role_code)
        self.page.wait_for_timeout(300)

    def open_global_search(self):
        """Opens the global command palette either via click or keyboard shortcut."""
        if self.search_button.is_visible():
            self.search_button.click()
        else:
            self.page.keyboard.press("ControlOrMeta+KeyK")

    def logout(self):
        """Logs out the current user."""
        expect(self.logout_button).to_be_visible()
        self.logout_button.click()
        self.page.wait_for_url(re.compile(r".*/login.*"), timeout=8000)
