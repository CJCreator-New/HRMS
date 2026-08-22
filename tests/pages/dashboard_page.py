"""
Dashboard Page Object for HRMS Executive & Employee Home (/).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage
from tests.components.punch_button import PunchButtonComponent


class DashboardPage(BasePage):
    PATH = "/"

    def __init__(self, page: Page):
        super().__init__(page)
        self.punch_button = PunchButtonComponent(page)
        self.role_greeting = page.locator("[data-testid='role-greeting'], h1, h2").first
        self.quick_action_cards = page.locator(".grid a, .grid button").all()

    def get_role_greeting(self) -> str:
        """Returns the greeting message on the dashboard."""
        return self.role_greeting.inner_text().strip() if self.role_greeting.is_visible() else ""

    def click_quick_action(self, action_name: str):
        """Clicks a quick action card by text."""
        card = self.page.locator("a, button").filter(has_text=action_name).first
        expect(card).to_be_visible()
        card.click()
        self.page.wait_for_load_state("domcontentloaded")
