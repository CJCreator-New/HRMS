"""
Reimbursements Workspace Page Object (/reimbursements).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage
from tests.components.modal import ModalComponent


class ReimbursementsPage(BasePage):
    PATH = "/reimbursements"

    def __init__(self, page: Page):
        super().__init__(page)
        self.new_claim_btn = (
            page.locator("button")
            .filter(has_text="New Expense Claim")
            .or_(page.locator("button").filter(has_text="Submit Claim"))
            .first
        )
        self.modal = ModalComponent(page)

        # Claim form
        self.title_input = page.locator("input[name='title'], input[placeholder*='Title']").first
        self.amount_input = page.locator("input[name='amount'], input[type='number']").first
        self.category_select = page.locator("select[name='category'], select").first
        self.submit_claim_btn = (
            page.locator("button[type='submit']").or_(page.locator("button").filter(has_text="Submit Claim")).first
        )

    def submit_expense_claim(self, title: str, amount: str, category_idx: int = 1):
        """Creates and submits a new expense reimbursement claim."""
        expect(self.new_claim_btn).to_be_visible()
        self.new_claim_btn.click()
        if self.title_input.is_visible():
            self.title_input.fill(title)
        if self.amount_input.is_visible():
            self.amount_input.fill(amount)
        if self.category_select.is_visible():
            self.category_select.select_option(index=category_idx)
        expect(self.submit_claim_btn).to_be_enabled()
        self.submit_claim_btn.click()
