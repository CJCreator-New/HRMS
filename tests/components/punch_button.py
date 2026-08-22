"""
Punch Button Component Object.
Interacts with Punch In / Punch Out buttons on Dashboard and Attendance pages.
"""

from playwright.sync_api import Page, Locator, expect


class PunchButtonComponent:
    def __init__(self, page: Page):
        self.page = page
        self.punch_in_button = page.locator("[data-testid='punch-in-btn']").or_(page.locator("button[aria-label*='Punch In']")).first
        self.punch_out_button = page.locator("[data-testid='punch-out-btn']").or_(page.locator("button[aria-label*='Punch Out']")).first
        self.toggle_button = page.locator("button[aria-label*='Punch ']").first

    def is_visible(self) -> bool:
        return self.toggle_button.is_visible() or self.punch_in_button.is_visible()

    def is_checked_in(self) -> bool:
        """Determines if the employee is currently punched in."""
        if self.toggle_button.is_visible():
            return "Punch Out" in self.toggle_button.inner_text()
        if self.punch_out_button.is_visible():
            return self.punch_out_button.is_enabled()
        return False

    def punch_in(self):
        """Triggers a Punch In action."""
        btn = self.punch_in_button if self.punch_in_button.is_visible() else self.toggle_button
        expect(btn).to_be_visible()
        btn.click()
        self.page.wait_for_timeout(500)

    def punch_out(self):
        """Triggers a Punch Out action."""
        btn = self.punch_out_button if self.punch_out_button.is_visible() else self.toggle_button
        expect(btn).to_be_visible()
        btn.click()
        self.page.wait_for_timeout(500)
