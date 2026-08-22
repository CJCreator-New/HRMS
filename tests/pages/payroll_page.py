"""
Payroll Workspace Page Object (/payroll).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage
from tests.components.modal import ModalComponent


class PayrollPage(BasePage):
    PATH = "/payroll"

    def __init__(self, page: Page):
        super().__init__(page)
        self.stepper = page.locator("[data-testid='stepper'], ol, .stepper, nav[aria-label='Progress']").first
        self.run_payroll_button = (
            page.locator("[data-testid='run-payroll-btn'], button")
            .filter(has_text="Execute Bulk Payroll Run")
            .or_(page.locator("[data-testid='reopen-payroll-btn']"))
            .or_(page.locator("button").filter(has_text="Run Payroll"))
            .first
        )
        self.finalize_button = (
            page.locator("[data-testid='finalize-payroll-btn'], button")
            .filter(has_text="Finalize Payroll")
            .or_(page.locator("button").filter(has_text="Finalize"))
            .first
        )
        self.publish_button = (
            page.locator("[data-testid='publish-payroll-btn'], button")
            .filter(has_text="Publish Payslips")
            .or_(page.locator("button").filter(has_text="Publish"))
            .first
        )
        self.reopen_button = page.locator("[data-testid='reopen-payroll-btn'], button").filter(has_text="Reopen").first
        self.confirm_dialog = ModalComponent(page, test_id="confirm-dialog")
        self.download_payslip_btn = (
            page.locator("[data-testid='download-payslip-btn'], button, a")
            .filter(has_text="Download Payslip")
            .or_(page.locator("button, a").filter(has_text="PDF"))
            .first
        )

    def click_run_payroll(self):
        """Initiates payroll calculation run."""
        expect(self.run_payroll_button).to_be_visible()
        self.run_payroll_button.click()

    def click_finalize(self):
        """Finalizes the calculated payroll cycle."""
        expect(self.finalize_button).to_be_visible()
        self.finalize_button.click()

    def click_publish(self):
        """Publishes finalized payslips to employees."""
        expect(self.publish_button).to_be_visible()
        self.publish_button.click()

    def reopen_payroll_for_revision(self):
        """Reopens payroll cycle via confirmation dialog."""
        expect(self.reopen_button).to_be_visible()
        self.reopen_button.click()
        if self.confirm_dialog.is_open():
            self.confirm_dialog.confirm()
