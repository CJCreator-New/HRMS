"""
Attendance Workspace Page Object (/attendance).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage
from tests.components.punch_button import PunchButtonComponent
from tests.components.datatable import DataTableComponent
from tests.components.modal import ModalComponent


class AttendancePage(BasePage):
    PATH = "/attendance"

    def __init__(self, page: Page):
        super().__init__(page)
        self.punch_button = PunchButtonComponent(page)
        self.table = DataTableComponent(page, name="attendance")
        self.regularize_button = (
            page.locator("[data-testid='open-correction-modal-btn'], button")
            .filter(has_text="Submit Correction")
            .or_(page.locator("button").filter(has_text="Regularize"))
            .first
        )
        self.modal = ModalComponent(page)

        # Regularization form inputs (lazy locators)
        self.reg_check_in_input = page.locator("input[type='time']").first
        self.reg_check_out_input = page.locator("input[type='time']").nth(1)
        self.reg_reason_input = page.locator("textarea, input[placeholder*='reason']").first
        self.reg_submit_button = (
            page.locator("button[type='submit']")
            .or_(page.locator("button").filter(has_text="Submit Correction"))
            .or_(page.locator("button").filter(has_text="Submit Request"))
            .first
        )

    def open_regularization_modal(self):
        """Opens the attendance regularization request modal if button is present."""
        if self.regularize_button.is_visible():
            self.regularize_button.click()
            expect(self.modal.dialog.or_(self.page.locator("[role='dialog']")).first).to_be_visible()

    def submit_regularization(self, date_str: str, check_in: str, check_out: str, reason: str):
        """Submits an attendance correction request."""
        if self.regularize_button.is_visible():
            self.open_regularization_modal()
            if self.reg_check_in_input.is_visible():
                self.reg_check_in_input.fill(check_in)
            if self.reg_check_out_input.is_visible():
                self.reg_check_out_input.fill(check_out)
            if self.reg_reason_input.is_visible():
                self.reg_reason_input.fill(reason)
            if self.reg_submit_button.is_visible():
                expect(self.reg_submit_button).to_be_enabled()
                self.reg_submit_button.click()
