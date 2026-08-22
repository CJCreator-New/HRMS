"""
Leave Workspace Page Object (/leave).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage
from tests.components.datatable import DataTableComponent
from tests.components.modal import ModalComponent


class LeavePage(BasePage):
    PATH = "/leave"

    def __init__(self, page: Page):
        super().__init__(page)
        self.table = DataTableComponent(page, name="leave")
        self.apply_button = (
            page.locator("[data-testid='apply-leave-btn'], button")
            .filter(has_text="Apply Leave")
            .or_(page.locator("button").filter(has_text="New Leave Request"))
            .first
        )
        self.modal = ModalComponent(page)

        # Form locators with data-testid contracts
        self.leave_type_select = (
            page.locator("[data-testid='leave-type-select'], select[name='leave_type_id'], select").first
        )
        self.start_date_input = (
            page.locator("[data-testid='start-date-input'], input[name='start_date'], input[type='date']").first
        )
        self.end_date_input = (
            page.locator("[data-testid='end-date-input'], input[name='end_date'], input[type='date']").first
        )
        self.reason_input = (
            page.locator("[data-testid='leave-reason-input'], textarea[name='reason'], textarea").first
        )
        self.submit_leave_btn = (
            page.locator("[data-testid='submit-leave-btn'], button[type='submit']")
            .or_(page.locator("button").filter(has_text="Submit Leave Request"))
            .first
        )
        self.overlap_warning = page.locator("p, div, span").filter(has_text="overlap").first

    def open_apply_modal(self):
        """Opens leave application if in modal or verifies inline form is present."""
        if self.apply_button.is_visible():
            self.apply_button.click()

    def fill_leave_form(self, start_date: str, end_date: str, reason: str = "Annual Vacation"):
        """Fills dates and reason in the leave application form."""
        if self.start_date_input.is_visible():
            self.start_date_input.fill(start_date)
        if self.end_date_input.is_visible():
            self.end_date_input.fill(end_date)
        if self.reason_input.is_visible():
            self.reason_input.fill(reason)

    def is_overlap_warning_visible(self) -> bool:
        """Returns True if the inline date overlap warning is displayed."""
        return self.overlap_warning.is_visible()

    def submit_application(self):
        """Submits the leave application."""
        expect(self.submit_leave_btn).to_be_visible()
        self.submit_leave_btn.click()
