"""
Permissions & Comp-Off Management Page Object (/permissions).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage


class PermissionsPage(BasePage):
    PATH = "/permissions"

    def __init__(self, page: Page):
        super().__init__(page)
        self.quota_badge = (
            page.locator("[data-testid='quota-badge'], span")
            .filter(has_text="mins")
            .or_(page.locator("span").filter(has_text="Quota"))
            .first
        )
        self.apply_permission_btn = (
            page.locator("button")
            .filter(has_text="Request Permission")
            .or_(page.locator("button").filter(has_text="Apply"))
            .first
        )
        self.duration_input = page.locator("input[name='duration_minutes'], input[type='number']").first
        self.reason_input = page.locator("textarea[name='reason'], textarea").first
        self.submit_btn = page.locator("button[type='submit']").or_(page.locator("button").filter(has_text="Submit")).first

    def get_remaining_quota_text(self) -> str:
        """Returns the monthly short permission quota text."""
        return self.quota_badge.inner_text().strip() if self.quota_badge.is_visible() else ""

    def apply_short_permission(self, duration_mins: str, reason: str = "Medical appointment"):
        """Submits a short permission request."""
        if self.apply_permission_btn.is_visible():
            self.apply_permission_btn.click()
        if self.duration_input.is_visible():
            self.duration_input.fill(duration_mins)
        if self.reason_input.is_visible():
            self.reason_input.fill(reason)
        if self.submit_btn.is_visible():
            expect(self.submit_btn).to_be_enabled()
            self.submit_btn.click()
