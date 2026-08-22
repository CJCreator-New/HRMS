"""
Offboarding & Separation Workspace Page Object (/offboarding).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage
from tests.components.modal import ModalComponent


class OffboardingPage(BasePage):
    PATH = "/offboarding"

    def __init__(self, page: Page):
        super().__init__(page)
        self.submit_resignation_btn = (
            page.locator("[data-testid='submit-resignation-btn'], button")
            .filter(has_text="Submit Resignation")
            .first
        )
        self.modal = ModalComponent(page)
        self.notice_input = page.locator("#noticeDaysInput, input[type='number']").first
        self.resig_date_input = page.locator("#resigDateInput, input[type='date']").first

    def initiate_resignation(self, reason: str = "Pursuing new career opportunity", lwd: str = "2026-09-30"):
        """Submits employee resignation."""
        self.submit_resignation_btn.wait_for(state="visible", timeout=12000)
        self.submit_resignation_btn.click()
        self.page.wait_for_timeout(600)
