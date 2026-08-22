"""
Company Settings Page Object (/settings).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage


class SettingsPage(BasePage):
    PATH = "/settings"

    def __init__(self, page: Page):
        super().__init__(page)
        self.company_name_input = page.locator("input[name='company_name'], input[placeholder*='Company']").first
        self.save_settings_btn = (
            page.locator("button[type='submit']").or_(page.locator("button").filter(has_text="Save Changes")).first
        )
        self.reset_mock_data_btn = (
            page.locator("button")
            .filter(has_text="Reset Mock Data")
            .or_(page.locator("button").filter(has_text="Reset Sandbox"))
            .first
        )

    def update_company_name(self, new_name: str):
        """Updates company name in settings."""
        expect(self.company_name_input).to_be_visible()
        self.company_name_input.fill(new_name)
        expect(self.save_settings_btn).to_be_enabled()
        self.save_settings_btn.click()
